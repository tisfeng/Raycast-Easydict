import { ofetch } from "ofetch";

export interface Connection {
  url: string;
  apiKey: string;
}
export function endpoint(value: string): string {
  const input = value.trim() || "http://127.0.0.1:8765";
  const url = new URL(input.includes("://") ? input : `http://${input}`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("Use an HTTP(S) AnkiConnect URL without credentials or a fragment.");
  }
  return url.toString();
}
function causeMatches(error: unknown, pattern: RegExp): boolean {
  if (!error || typeof error !== "object") return false;
  return (
    ("name" in error && pattern.test(String(error.name))) ||
    ("message" in error && pattern.test(String(error.message))) ||
    ("cause" in error && error.cause !== error && causeMatches(error.cause, pattern))
  );
}
function authenticationError(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && [401, 403].includes(Number(error.status));
}
function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
export class AnkiClient {
  constructor(readonly connection: Connection) {}
  async call<T>(action: string, params: object = {}, write = false): Promise<T> {
    const url = endpoint(this.connection.url);
    let response: { result: T; error: string | null };
    try {
      response = await ofetch(url, {
        method: "POST",
        retry: 0,
        timeout: 15000,
        body: { action, version: 6, params, ...(this.connection.apiKey ? { key: this.connection.apiKey } : {}) },
        parseResponse: JSON.parse,
      });
    } catch (error) {
      if (!write) {
        if (authenticationError(error)) throw new Error("Authentication failed. Check the AnkiConnect API key.");
        if (causeMatches(error, /Timeout|Abort|timed out/i))
          throw new Error("AnkiConnect timed out. Check Anki and the URL, then retry.");
        if (causeMatches(error, /SyntaxError|JSON/i))
          throw new Error("Invalid AnkiConnect response. Check that this URL points to AnkiConnect.");
      }
      throw new Error(
        write
          ? "Anki did not confirm the write. Check Anki before retrying; the note or media may already have been saved."
          : "Cannot reach AnkiConnect. Open Anki, check the URL and API key, and confirm the add-on is installed.",
      );
    }
    if (!response || typeof response !== "object" || !("result" in response) || !("error" in response))
      throw new Error("Invalid AnkiConnect response.");
    if (response.error) {
      if (/api.?key|unauthorized|authentication/i.test(response.error))
        throw new Error("Authentication failed. Check the AnkiConnect API key.");
      throw new Error(`AnkiConnect: ${response.error}`);
    }
    return response.result;
  }
  async fields(modelName: string) {
    const fields = await this.call<unknown>("modelFieldNames", { modelName });
    if (!stringList(fields) || !fields.length) throw new Error("Invalid AnkiConnect field response.");
    return fields;
  }
  async catalog() {
    const version = await this.call<number>("version");
    if (!Number.isInteger(version)) throw new Error("Invalid AnkiConnect version response.");
    if (version < 6) throw new Error("AnkiConnect version 6 or newer is required.");
    const [decks, models] = await Promise.all([this.call<string[]>("deckNames"), this.call<string[]>("modelNames")]);
    if (!stringList(decks) || !stringList(models)) throw new Error("Invalid AnkiConnect deck or note type response.");
    return { decks, models };
  }
  async createTemplate() {
    const modelName = "Easydict Capture";
    const models = await this.call<string[]>("modelNames");
    if (models.includes(modelName))
      throw new Error('"Easydict Capture" already exists. Select it or another note type.');
    await this.call(
      "createModel",
      {
        modelName,
        inOrderFields: ["English", "Chinese", "Example", "Context", "ID"],
        isCloze: false,
        css: ".card { font-family: sans-serif; font-size: 22px; line-height: 1.6; } img { max-width: 100%; } b.target { font-weight: 700; }",
        cardTemplates: [
          {
            Name: "Recognition",
            Front: "{{English}}",
            Back: "{{FrontSide}}<hr id=answer>{{Chinese}}<br>{{Example}}<br>{{Context}}",
          },
        ],
      },
      true,
    );
    return modelName;
  }
}
