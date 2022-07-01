/*
 * @author: tisfeng
 * @createTime: 2022-07-01 19:05
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-01 21:49
 * @fileName: version.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";

const versionInfoKey = "versionInfoKey";

export class EasydictVersionInfo {
  // new version info
  public version = "1.2.0";
  public versionDate = "2022-07-01";
  public isNeedPrompt = true;

  // save version info to local storage
  public storeVersionInfo() {
    const jsonString = JSON.stringify(this);
    LocalStorage.setItem(versionInfoKey, jsonString);
  }

  public async getVersionInfo(): Promise<EasydictVersionInfo | undefined> {
    const jsonString = await LocalStorage.getItem<string>(versionInfoKey);
    if (!jsonString) {
      return undefined;
    }
    return JSON.parse(jsonString);
  }

  /**
   * check if the version info is updated, return callback if updated.
   */
  public async checkVersion(callback: (isUpdated: boolean) => void) {
    console.log("check version");
    const storedVersionInfo = await this.getVersionInfo();
    console.log(`stored version: ${JSON.stringify(storedVersionInfo, null, 2)} `);
    if (storedVersionInfo) {
      const updated = this.version === storedVersionInfo.version;
      callback(updated);
    } else {
      callback(false);
    }

    LocalStorage.removeItem(versionInfoKey);
  }
}
