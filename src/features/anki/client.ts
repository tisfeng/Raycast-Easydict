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
    } catch {
      throw new Error(
        write
          ? "Anki did not confirm the write. Check Anki before retrying; the note or media may already have been saved."
          : "Cannot reach AnkiConnect. Open Anki, check the URL and API key, and confirm the add-on is installed.",
      );
    }
    if (!response || typeof response !== "object" || !("result" in response) || !("error" in response))
      throw new Error("Invalid AnkiConnect response.");
    if (response.error) throw new Error(`AnkiConnect: ${response.error}`);
    return response.result;
  }
  fields(modelName: string) {
    return this.call<string[]>("modelFieldNames", { modelName });
  }
  async catalog() {
    const version = await this.call<number>("version");
    if (version < 6) throw new Error("AnkiConnect version 6 or newer is required.");
    const [decks, models] = await Promise.all([this.call<string[]>("deckNames"), this.call<string[]>("modelNames")]);
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
        inOrderFields: ["English", "Chinese", "Example", "Context"],
        isCloze: false,
        css: ".card { font-family: sans-serif; font-size: 22px; line-height: 1.6; } img { max-width: 100%; }",
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
