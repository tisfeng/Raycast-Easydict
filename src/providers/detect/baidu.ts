/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";

import type { DetectedLangModel } from "@/core/detect/types";
import { LanguageDetectType } from "@/core/detect/types";
import { baiduMap, getYoudaoLangCode, isValidLangCode } from "@/core/language/utils";
import { myPreferences } from "@/preferences";
import type { QueryResponse } from "@/types/queryResponse";
import { getTypeErrorInfo, RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace } from "@/utils/logger";

import { BaseDetectProvider } from "./base";

interface BaiduWebLanguageDetect {
  error?: number;
  msg?: string;
  lan?: string;
}

export class BaiduDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Baidu;

  isEnabled(): boolean {
    return myPreferences.enableBaiduLanguageDetect;
  }

  protected async doDetect(text: string): Promise<DetectedLangModel> {
    logTrace("baidu", "start BaiduDetectProvider.doDetect");

    const url = "https://fanyi.baidu.com/langdetect";
    const params = { query: text };

    try {
      const response = await timedFetch<BaiduWebLanguageDetect>(url, {
        method: "POST",
        body: querystring.stringify(params),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (response.error === 0) {
        const baiduLanguageId = response.lan || "";
        const youdaoLanguageId = getYoudaoLangCode(baiduLanguageId, baiduMap);
        const isConfirmed = isValidLangCode(youdaoLanguageId);
        logTrace("baidu", `detected: ${baiduLanguageId}`);

        return {
          type: LanguageDetectType.Baidu,
          sourceLangCode: baiduLanguageId,
          youdaoLangCode: youdaoLanguageId,
          confirmed: isConfirmed,
          result: response as QueryResponse,
        };
      }

      const errorInfo = new RequestError(
        LanguageDetectType.Baidu,
        response.msg || "",
        response.error ? response.error.toString() : "",
      );
      logError("baidu", `web detect error: ${JSON.stringify(response)}`);
      throw errorInfo;
    } catch (error: unknown) {
      const err = error as { message?: string; name?: string };
      if (err.message === "canceled" || err.name === "AbortError") {
        logTrace("baidu", "detect canceled");
        throw undefined;
      }
      if (error instanceof RequestError) throw error;
      logError("baidu", `web Baidu language detect error: ${error}`);
      throw getTypeErrorInfo(
        LanguageDetectType.Baidu,
        error as { status?: number; statusText?: string; message?: string },
      );
    }
  }
}
