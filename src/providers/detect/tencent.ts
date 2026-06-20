/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import * as tencentcloud from "tencentcloud-sdk-nodejs-tmt";

import type { DetectedLangModel } from "@/core/detect/types";
import { getYoudaoLangCode, tencentDetectMap } from "@/core/language/utils";
import { ProviderConfig } from "@/providers/shared";
import { LanguageDetectType } from "@/types/api";
import { logTrace, logWarn } from "@/utils/logger";

import { BaseDetectProvider } from "./base";

const endpoint = "tmt.tencentcloudapi.com";
const region = "ap-guangzhou";
const projectId = 0;

const clientConfig = {
  credential: {
    secretId: ProviderConfig.tencentSecretId,
    secretKey: ProviderConfig.tencentSecretKey,
  },
  region,
  profile: {
    httpProfile: {
      endpoint,
    },
  },
};

export class TencentDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Tencent;

  isEnabled(): boolean {
    const hasId = !!ProviderConfig.tencentSecretId;
    const hasKey = !!ProviderConfig.tencentSecretKey;
    if (!hasId || !hasKey) {
      logWarn("tencent", "detect has no app key");
      return false;
    }
    return true;
  }

  protected async doDetect(text: string): Promise<DetectedLangModel> {
    logTrace("tencent", "start TencentDetectProvider.doDetect");

    const startTime = new Date().getTime();
    const params = { Text: text, ProjectId: projectId };

    const TmtClient = tencentcloud.tmt.v20180321.Client;
    const client = new TmtClient(clientConfig);
    const response = await client.LanguageDetect(params);

    const endTime = new Date().getTime();
    const tencentLanguageId = response.Lang || "";
    const youdaoLanguageId = getYoudaoLangCode(tencentLanguageId, tencentDetectMap);
    logTrace("tencent", `detected: ${tencentLanguageId}, cost: ${endTime - startTime}ms`);

    return {
      type: LanguageDetectType.Tencent,
      sourceLangCode: tencentLanguageId,
      youdaoLangCode: youdaoLanguageId,
      confirmed: false,
    };
  }
}
