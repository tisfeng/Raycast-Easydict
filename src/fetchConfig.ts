/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { ofetch } from "ofetch";
import { networkTimeout } from "@/consts";

declare module "ofetch" {
  interface FetchOptions {
    startTime?: number;
  }
}

/**
 * Shared ofetch instance with timeout and automatic timing (dev mode only).
 */
export const timedFetch = ofetch.create({
  timeout: networkTimeout,

  onRequest({ options }) {
    if (environment.isDevelopment) {
      options.startTime = performance.now();
    }
  },

  onResponse({ options }) {
    if (environment.isDevelopment && options.startTime !== undefined) {
      const cost = (performance.now() - options.startTime).toFixed(0);
      console.log(`cost time: ${cost} ms`);
    }
  },
});
