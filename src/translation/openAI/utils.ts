/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { timedFetch } from "@/fetchConfig";
import { createParser } from "eventsource-parser";

interface FetchSSEOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  onMessage(data: string): void;
  onError(error: unknown): void;
}

export async function fetchSSE(input: string, options: FetchSSEOptions) {
  const { onMessage, onError, ...fetchOptions } = options;
  try {
    const stream = await timedFetch(input, {
      ...fetchOptions,
      responseType: "stream",
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const parser = createParser({
      onEvent: (event) => {
        onMessage(event.data);
      },
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const str = decoder.decode(value, { stream: true });
        parser.feed(str);
      }
    }
  } catch (error) {
    onError(error);
  }
}
