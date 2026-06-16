/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { createParser } from "eventsource-parser";

// Ref: https://github.com/douo/raycast-openai-translator/blob/main/src/providers/openai/utils.ts
interface FetchSSEOptions extends RequestInit {
  onMessage(data: string): void;
  onError(error: unknown): void;
}

export async function fetchSSE(input: string, options: FetchSSEOptions) {
  const { onMessage, onError, ...fetchOptions } = options;
  try {
    const resp = await fetch(input, fetchOptions);
    if (resp.status !== 200) {
      onError(await resp.json());
      return;
    }
    const parser = createParser({
      onEvent: (event) => {
        onMessage(event.data);
      },
    });
    if (resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const str = typeof value === "string" ? value : decoder.decode(value, { stream: true });
          parser.feed(str);
        }
      }
    }
  } catch (error) {
    onError(error);
  }
}
