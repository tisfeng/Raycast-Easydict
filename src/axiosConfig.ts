/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import axios from "axios";
import EventEmitter from "events";
import { networkTimeout } from "@/consts";

EventEmitter.defaultMaxListeners = 15; // default is 10.

/**
 * * Note: this function should be called as early as possible.
 */
configDefaultAxios();

/**
 * Calculate axios request cost time.
 */
export const requestCostTime = "requestCostTime";

/**
 * Config default axios: timeout, interceptors.
 */
function configDefaultAxios() {
  console.log(`configDefaultAxios`);

  // Set axios timeout to 15s, since we start a loading when request is sent, we need to cancel it when timeout.
  axios.defaults.timeout = networkTimeout;

  const requestStartTime = "request-startTime";

  axios.interceptors.request.use((config) => {
    if (config.headers) {
      config.headers[requestStartTime] = new Date().getTime();
    }
    return config;
  });

  axios.interceptors.response.use((response) => {
    if (response.config.headers) {
      const startTime = response.config.headers[requestStartTime] as number;
      const endTime = new Date().getTime();
      response.headers[requestCostTime] = (endTime - startTime).toString();
    }
    return response;
  });
}
