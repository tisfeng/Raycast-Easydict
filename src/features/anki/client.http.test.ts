import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnkiClient } from "./client";

let mode: "ok" | "auth" | "invalid" | "unavailable" = "ok";
const requests: { action: string; key?: string; version: number }[] = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  requests.push(body);
  response.setHeader("Content-Type", "application/json");
  if (mode === "auth") {
    response.statusCode = 403;
    response.end(JSON.stringify({ error: "forbidden" }));
    return;
  }
  if (mode === "invalid") {
    response.end('{"unexpected":true}');
    return;
  }
  if (mode === "unavailable") {
    response.destroy();
    return;
  }
  const result: Record<string, unknown> = {
    version: 6,
    deckNames: ["Local Deck"],
    modelNames: ["Basic"],
    modelFieldNames: ["Front", "Back"],
  };
  response.end(JSON.stringify({ result: result[body.action], error: null }));
});
let client: AnkiClient;
beforeEach(async () => {
  mode = "ok";
  requests.length = 0;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  client = new AnkiClient({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, apiKey: "fixture-key" });
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
describe("AnkiConnect HTTP protocol against a local fixture server", () => {
  it("loads deck names and fields through real JSON POST requests", async () => {
    expect(await client.catalog()).toEqual({ decks: ["Local Deck"], models: ["Basic"] });
    expect(await client.fields("Basic")).toEqual(["Front", "Back"]);
    expect(requests).toHaveLength(4);
    expect(requests.every((request) => request.version === 6 && request.key === "fixture-key")).toBe(true);
  });
  it("distinguishes HTTP authentication failure from invalid responses", async () => {
    mode = "auth";
    await expect(client.catalog()).rejects.toThrow("Authentication failed");
    expect(requests).toHaveLength(1);
    mode = "invalid";
    await expect(client.catalog()).rejects.toThrow("Invalid AnkiConnect response");
  });
  it("reports a dropped connection without retrying", async () => {
    mode = "unavailable";
    await expect(client.catalog()).rejects.toThrow("Cannot reach AnkiConnect");
    expect(requests).toHaveLength(1);
  });
});
