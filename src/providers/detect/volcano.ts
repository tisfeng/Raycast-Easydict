/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { DetectedLangModel } from "@/core/detect/types";
import { LanguageDetectType } from "@/core/detect/types";
import { getYoudaoLangCode, volcanoMap } from "@/core/language/utils";
import type { QueryResponse } from "@/types/queryResponse";
import { getTypeErrorInfo, RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace, logWarn } from "@/utils/logger";

import { genVolcanoSign } from "../translation/volcano/volcanoSign";
import { BaseDetectProvider } from "./base";

interface VolcanoDetectResult {
  DetectedLanguageList: { Language: string; Confidence: number }[];
  ResponseMetaData: {
    Error?: { Code: string; Message: string };
  };
}

export class VolcanoDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Volcano;

  isEnabled(): boolean {
    return true;
  }

  protected async doDetect(text: string): Promise<DetectedLangModel> {
    logTrace("volcano", "start VolcanoDetectProvider.doDetect");

    const query = { Action: "LangDetect", Version: "2020-06-01" };
    const params = { TextList: [text] };

    const signObject = genVolcanoSign(query, params);
    if (!signObject) {
      logWarn("volcano", "AccessKey or SecretKey is empty");
      return {
        type: LanguageDetectType.Volcano,
        sourceLangCode: "",
        youdaoLangCode: "",
        confirmed: false,
        result: undefined,
      };
    }

    const url = signObject.getUrl();
    const config = signObject.getConfig();

    try {
      const volcanoDetectResult = await timedFetch<VolcanoDetectResult>(url, {
        method: "POST",
        body: params,
        headers: config.headers,
      });

      const volcanoError = volcanoDetectResult.ResponseMetaData.Error;
      if (volcanoError) {
        logError("volcano", `detect error: ${JSON.stringify(volcanoDetectResult)}`);
        throw new RequestError(LanguageDetectType.Volcano, volcanoError.Message || "", volcanoError.Code || "");
      }

      const detectedLanguage = volcanoDetectResult.DetectedLanguageList[0];
      const volcanoLangCode = detectedLanguage.Language;
      const youdaoLangCode = getYoudaoLangCode(volcanoLangCode, volcanoMap);
      const isConfirmed = detectedLanguage.Confidence > 0.5;
      logTrace("volcano", `detect language: ${JSON.stringify(detectedLanguage)}, youdaoLangCode: ${youdaoLangCode}`);

      return {
        type: LanguageDetectType.Volcano,
        sourceLangCode: volcanoLangCode,
        youdaoLangCode,
        confirmed: isConfirmed,
        result: volcanoDetectResult as QueryResponse,
      };
    } catch (error: unknown) {
      const err = error as { message?: string; name?: string };
      if (err.message === "canceled" || err.name === "AbortError") {
        logTrace("volcano", "detect canceled");
        throw undefined;
      }
      if (error instanceof RequestError) throw error;
      logError("volcano", `detect err: ${JSON.stringify(error, null, 4)}`);
      throw getTypeErrorInfo(
        LanguageDetectType.Volcano,
        error as { status?: number; statusText?: string; message?: string },
      );
    }
  }
}
