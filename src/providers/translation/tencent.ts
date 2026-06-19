/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import crypto, { BinaryToTextEncoding } from "crypto";
import * as tencentcloud from "tencentcloud-sdk-nodejs-tmt";
import { TextTranslateResponse } from "tencentcloud-sdk-nodejs-tmt/tencentcloud/services/tmt/v20180321/tmt_models";

import { DetectedLangModel, LanguageDetectType } from "@/core/detect/types";
import { getLangCode, getYoudaoLangCode, tencentDetectMap } from "@/core/language/utils";
import { AppKeyStore } from "@/preferences";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { getErrorCode, getErrorMessage, RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace, logWarn } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

export interface TencentTranslateResult extends TextTranslateResponse {
  Error: TencentError;
}

export interface TencentError {
  Code: string;
  Message: string;
}

const SECRET_ID = AppKeyStore.tencentSecretId;
const SECRET_KEY = AppKeyStore.tencentSecretKey;

const endpoint = "tmt.tencentcloudapi.com";
const region = "ap-guangzhou";
const projectId = 0;

const clientConfig = {
  credential: {
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
  },
  region: region,
  profile: {
    httpProfile: {
      endpoint: endpoint,
    },
  },
};

/**
 * Tencent translate, use axios, sign manually. Cost time: ~0.1 ms
 *
 * Docs: https://cloud.tencent.com/document/api/551/15619
 * Ref: https://github.com/raycast/extensions/blob/8ec3e04197695a78691e508f33db2044dce3e16f/extensions/itranslate/src/itranslate.shared.tsx#L426
 */
export class TencentTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.Tencent;

  protected async doTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
    const { fromLanguage, toLanguage, word } = queryWordInfo;
    const from = getLangCode(fromLanguage, "tencentLangCode");
    const to = getLangCode(toLanguage, "tencentLangCode");

    if (!from || !to) {
      logWarn("tencent", `translate not support language: ${fromLanguage} --> ${toLanguage}`);
      return {
        type: TranslationType.Tencent,
        result: undefined,
        translations: [],
        queryWordInfo,
      };
    }

    function sha256(message: string, secret = "", encoding?: BinaryToTextEncoding) {
      const hmac = crypto.createHmac("sha256", secret);
      return hmac.update(message).digest(encoding as BinaryToTextEncoding);
    }

    function getHash(message: string) {
      const hash = crypto.createHash("sha256");
      return hash.update(message).digest("hex");
    }

    function getDate(timestamp: number) {
      const date = new Date(timestamp * 1000);
      const year = date.getUTCFullYear();
      const month = ("0" + (date.getUTCMonth() + 1)).slice(-2);
      const day = ("0" + date.getUTCDate()).slice(-2);
      return `${year}-${month}-${day}`;
    }

    const action = "TextTranslate";
    const version = "2018-03-21";
    const algorithm = "TC3-HMAC-SHA256";
    const signedHeaders = "content-type;host";
    const service = "tmt";

    const timestamp = Math.trunc(new Date().getTime() / 1000);
    const date = getDate(timestamp);

    const payload = {
      SourceText: word,
      Source: from,
      Target: to,
      ProjectId: 0,
    };

    const hashedRequestPayload = getHash(JSON.stringify(payload));
    const httpRequestMethod = "POST";
    const canonicalUri = "/";
    const canonicalQueryString = "";
    const canonicalHeaders = "content-type:application/json; charset=utf-8\n" + "host:" + endpoint + "\n";

    const canonicalRequest =
      httpRequestMethod +
      "\n" +
      canonicalUri +
      "\n" +
      canonicalQueryString +
      "\n" +
      canonicalHeaders +
      "\n" +
      signedHeaders +
      "\n" +
      hashedRequestPayload;

    const hashedCanonicalRequest = getHash(canonicalRequest);
    const credentialScope = date + "/" + service + "/" + "tc3_request";
    const stringToSign = algorithm + "\n" + timestamp + "\n" + credentialScope + "\n" + hashedCanonicalRequest;

    const kDate = sha256(date, "TC3" + SECRET_KEY);
    const kService = sha256(service, kDate);
    const kSigning = sha256("tc3_request", kService);
    const signature = sha256(stringToSign, kSigning, "hex");

    const authorization =
      algorithm +
      " " +
      "Credential=" +
      SECRET_ID +
      "/" +
      credentialScope +
      ", " +
      "SignedHeaders=" +
      signedHeaders +
      ", " +
      "Signature=" +
      signature;

    const data = await timedFetch<{ Response: TencentTranslateResult }>(`https://${endpoint}`, {
      method: "POST",
      body: payload,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: endpoint,
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp.toString(),
        "X-TC-Version": version,
        "X-TC-Region": region,
      },
      signal,
    });

    const tencentResult = data.Response;

    const error = tencentResult.Error;
    if (error) {
      logError("tencent", `translate error: ${error.Message}`);
      throw new RequestError(TranslationType.Tencent, error.Message);
    }

    const targetText = tencentResult.TargetText || "";
    const translations = targetText.split("\n");
    logTrace("tencent", `translations: ${translations}, ${tencentResult.Source}`);

    return {
      type: TranslationType.Tencent,
      result: tencentResult,
      translations,
      queryWordInfo,
    };
  }
}

/**
 * Tecent language detect, use Tencent nodejs sdk. Cost time: ~150ms
 *
 * 腾讯语种识别，5 次/秒：https://cloud.tencent.com/document/product/551/15620?cps_key=1d358d18a7a17b4a6df8d67a62fd3d3d
 *
 * Todo: use axios to rewrite.
 */
export function tencentDetect(text: string): Promise<DetectedLangModel> {
  logTrace("tencent", "start sdk request Tencent detect");

  const params = {
    Text: text,
    ProjectId: projectId,
  };
  const startTime = new Date().getTime();
  const type = LanguageDetectType.Tencent;

  if (!hasTencentAppKey()) {
    logWarn("tencent", "detect has no app key");
    const result: DetectedLangModel = {
      type: type,
      sourceLangCode: "",
      youdaoLangCode: "",
      confirmed: false,
    };
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    const TmtClient = tencentcloud.tmt.v20180321.Client;
    const client = new TmtClient(clientConfig);

    client
      .LanguageDetect(params)
      .then((response) => {
        const endTime = new Date().getTime();
        const tencentLanguageId = response.Lang || "";
        const youdaoLanguageId = getYoudaoLangCode(tencentLanguageId, tencentDetectMap);
        logTrace("tencent", `detected: ${tencentLanguageId}, cost: ${endTime - startTime}ms`);
        const typeResult: DetectedLangModel = {
          type: type,
          sourceLangCode: tencentLanguageId,
          youdaoLangCode: youdaoLanguageId,
          confirmed: false,
        };
        resolve(typeResult);
      })
      .catch((err) => {
        const message = getErrorMessage(err);
        const code = getErrorCode(err);
        logError("tencent", `detect error, code: ${code}, message: ${message}`);
        reject(new RequestError(type, message, code));
      });
  });
}

/**
 * Check has Tencent AppId and AppKey.
 */
export function hasTencentAppKey(): boolean {
  const AppId = AppKeyStore.tencentSecretId;
  const AppSecret = AppKeyStore.tencentSecretKey;

  if (AppId && AppSecret) {
    return true;
  } else {
    return false;
  }
}
