/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-01 20:27
 * @fileName: axiosConfig.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { environment, LocalStorage, showToast, Toast } from "@raycast/api";
import axios, { AxiosRequestConfig } from "axios";
import EventEmitter from "events";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getMacSystemProxy } from "mac-system-proxy";
import { printObject } from "./utils";

EventEmitter.defaultMaxListeners = 15; // default is 10.

/**
 * Calculate axios request cost time.
 */
export const requestCostTime = "requestCostTime";

export const systemProxyURLKey = "systemProxyURL";

export let httpsAgent: HttpsProxyAgent | undefined;

/**
 * Becacuse get system proxy will block 0.4s, we need to get it after finish query.
 */
export const delayTimeToGetSystemProxy = 2000;

configDefaultAxios();

function configDefaultAxios() {
  // Set axios timeout to 15s, since we start a loading when request is sent, we need to cancel it when timeout.
  axios.defaults.timeout = 15000;

  const requestStartTime = "request-startTime";

  axios.interceptors.request.use(function (config: AxiosRequestConfig) {
    if (config.headers) {
      config.headers[requestStartTime] = new Date().getTime();
    }
    return config;
  });
  axios.interceptors.response.use(function (response) {
    if (response.config.headers) {
      const startTime = response.config.headers[requestStartTime] as number;
      const endTime = new Date().getTime();
      response.headers[requestCostTime] = (endTime - startTime).toString();
    }
    return response;
  });
}

/**
 * Config axios default proxy.
 *
 * * Since directly use system proxy will block thread, we try to get proxy url from local storage first.
 */
export function configAxiosProxy(): Promise<void> {
  console.log(`---> configAxiosProxy`);

  return new Promise((resolve) => {
    getStoredProxyURL()
      .then((proxyURL) => {
        if (proxyURL) {
          configAxiosAgent(proxyURL);
          return resolve();
        }

        getSystemProxyURL()
          .then((proxyURL) => {
            configAxiosAgent(proxyURL);
            resolve();
          })
          .catch((error) => {
            const errorString = JSON.stringify(error) || "";
            console.error(`---> getStoredProxyURL error: ${errorString}`);
            resolve();
          });
      })
      .catch((error) => {
        const errorString = JSON.stringify(error) || "";
        console.error(`---> configAxiosProxy error: ${errorString}`);
        showToast({
          style: Toast.Style.Failure,
          title: `Config proxy error`,
          message: errorString,
        });
        resolve();
      });
  });
}

/**
 * Config axios agent with proxy url.
 */
export function configAxiosAgent(proxyURL: string | undefined): void {
  console.log(`---> configAxiosAgent: ${proxyURL}`);
  if (!proxyURL) {
    axios.defaults.httpsAgent = undefined;
    return;
  }

  const httpsAgent = new HttpsProxyAgent(proxyURL);
  printObject(`---> httpsAgent`, httpsAgent);
  axios.defaults.httpsAgent = httpsAgent;
}

/**
 * Get stored system proxy url.
 */
export async function getStoredProxyURL(): Promise<string | undefined> {
  console.log(`start getStoredProxyURL`);

  return new Promise((resolve) => {
    LocalStorage.getItem<string>(systemProxyURLKey).then((systemProxyURL) => {
      if (!systemProxyURL) {
        console.log(`---> getStoredProxyURL: no stored proxy url, get system proxy url`);
        resolve(undefined);
        return;
      }

      console.log(`---> get system proxy from local storage: ${systemProxyURL}`);
      resolve(systemProxyURL);
    });
  });
}

/**
 * Get system proxy URL, and save it to local storage.
 *
 * * Note: get system proxy can block ~0.4s, so should call it at the right time.
 */
export function getSystemProxyURL(): Promise<string | undefined> {
  console.log(`---> start getSystemProxyURL`);

  return new Promise((resolve, reject) => {
    /**
     * * Note: need to set env.PATH manually, otherwise will get error: "Error: spawn scutil ENOENT"
     * Detail:  https://github.com/httptoolkit/mac-system-proxy/issues/1
     */

    const env = process.env;
    // Raycast default "PATH": "/usr/bin:undefined"
    // console.log(`---> env: ${JSON.stringify(env, null, 2)}`);

    // env.PATH = "/usr/sbin"; // $ where scutil
    env.PATH = "/usr/sbin:/usr/bin:/bin:/sbin";
    // console.log(`---> env: ${JSON.stringify(env, null, 2)}`);

    if (environment.isDevelopment) {
      /**
       * handle error: unable to verify the first certificate.
       *
       * Ref: https://stackoverflow.com/questions/31673587/error-unable-to-verify-the-first-certificate-in-nodejs
       */
      // env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
    }

    // Remove previous system proxy URL.
    LocalStorage.removeItem(systemProxyURLKey);

    const startTime = Date.now();

    // * This function is sync and will block ~0.4s, even it's a promise.
    getMacSystemProxy()
      .then((systemProxy) => {
        console.log(`---> get system proxy: ${JSON.stringify(systemProxy, null, 2)}`);
        if (!systemProxy.HTTPEnable || !systemProxy.HTTPProxy) {
          console.log(`---> no system http proxy`);
          return resolve(undefined);
        }

        const proxyURL = `http://${systemProxy.HTTPProxy}:${systemProxy.HTTPPort}`;
        console.warn(`---> get system proxy url: ${proxyURL}`);
        console.log(`get system proxy cost: ${Date.now() - startTime} ms`);
        LocalStorage.setItem(systemProxyURLKey, proxyURL);

        const httpsAgent = new HttpsProxyAgent(proxyURL);
        printObject(`---> httpsAgent`, httpsAgent);

        resolve(proxyURL);
      })
      .catch((err) => {
        // console.error(`---> get system proxy error: ${JSON.stringify(err, null, 2)}`);
        reject(err);
      })
      .finally(() => {
        // ! need to reset env.PATH, otherwise, will throw error: '/bin/sh: osascript: command not found'
        delete env.PATH; // env.PATH = "/usr/sbin:/usr/bin:/bin:/sbin";
      });
  });
}

/**
 * Get proxy agent.
 *
 * * Since translate.google.cn is not available anymore, we have to try to use proxy by default.
 *
 * * Note: this function will block ~0.4s, so should call it at the right time.
 */
export function getProxyAgent(): Promise<HttpsProxyAgent | undefined> {
  console.log(`---> start getProxyAgent`);

  if (httpsAgent) {
    console.log(`---> return cached httpsAgent`);
    return Promise.resolve(httpsAgent);
  }

  // return Promise.resolve(undefined);

  return new Promise((resolve) => {
    console.log(`---> getProxyAgent`);

    getStoredProxyURL()
      .then((systemProxyURL) => {
        if (!systemProxyURL) {
          console.log(`---> no system proxy url, use direct agent`);
          resolve(undefined);
        } else {
          console.log(`---> get system proxy url: ${systemProxyURL}`);
          const agent = new HttpsProxyAgent(systemProxyURL);
          httpsAgent = agent;
          resolve(agent);
        }
      })
      .catch((error) => {
        console.error(`---> get system proxy url error: ${error}`);
        resolve(undefined);
      });
  });
}
