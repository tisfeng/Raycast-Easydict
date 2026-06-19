/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { AppKeyStore } from "@/preferences";

export function hasBaiduAppKey(): boolean {
  return !!(AppKeyStore.baiduAppId && AppKeyStore.baiduAppSecret);
}

export function hasTencentAppKey(): boolean {
  return !!(AppKeyStore.tencentSecretId && AppKeyStore.tencentSecretKey);
}

export function hasVolcanoAppKey(): boolean {
  return !!(AppKeyStore.volcanoSecretId && AppKeyStore.volcanoSecretKey);
}
