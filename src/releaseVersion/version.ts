/*
 * @author: tisfeng
 * @createTime: 2022-07-01 19:05
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-02 16:44
 * @fileName: version.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";
import axios from "axios";

const versionInfoKey = "EasydictVersionInfoKey";

export class EasydictInfo {
  // new version info
  version = "1.2.0";
  buildNumber = 3;
  versionDate = "2022-07-01";
  isNeedPrompt = true;
  hasPrompt = false;
  releaseMarkdown = "";

  // repo info
  author = "tisfeng";
  repo = "Raycast-Easydict";
  repoUrl = "https://github.com/tisfeng/Raycast-Easydict";
  githubAPIUrl = "https://api.github.com";

  /**
   * 项目中文介绍 https://github.com/tisfeng/Raycast-Easydict/wiki
   */
  public getChineseWikiUrl() {
    return `${this.repoUrl}/wiki`;
  }

  /**
   *  Release tag url: /repos/{owner}/{repo}/releases/tags/{tag}
   *  https://api.github.com/repos/tisfeng/Raycast-Easydict/releases/tags/1.1.0
   * @returns
   */
  public getReleaseTagUrl() {
    return `${this.githubAPIUrl}/repos/${this.repo}/releases/tags/${this.version}`;
  }

  /**
   * Get current version info, return a promise EasydictInfo.
   */
  async getCurrentStoredVersionInfo(): Promise<EasydictInfo | undefined> {
    const currentVersionKey = `${versionInfoKey}-${this.version}`;
    return this.getVersionInfo(currentVersionKey);
  }

  /**
   * Store current version info.
   */
  public storeCurrentVersionInfo() {
    const jsonString = JSON.stringify(this);
    const currentVersionKey = `${versionInfoKey}-${this.version}`;
    LocalStorage.setItem(currentVersionKey, jsonString);

    // Todo: remove this line, this is for test
    LocalStorage.removeItem(currentVersionKey);
  }

  /**
   * Get version info with version key, return a promise EasydictInfo.
   */
  async getVersionInfo(versionKey: string): Promise<EasydictInfo | undefined> {
    const jsonString = await LocalStorage.getItem<string>(versionKey);
    if (!jsonString) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(JSON.parse(jsonString));
  }

  /**
   * Check if has new version, return promise boolean.
   */
  public async checkHasNewVersion(): Promise<boolean> {
    const storedVersionInfo = await this.getCurrentStoredVersionInfo();
    if (storedVersionInfo) {
      const currentVersion = parseFloat(this.version);
      const storedVersion = parseFloat(storedVersionInfo.version);
      const hasNewVersion = currentVersion > storedVersion;
      return Promise.resolve(hasNewVersion);
    }
    return Promise.resolve(true);
  }

  /**
   * Use axios to get github latest release, return a promise
   */
  public fetchLatestReleaseInfo = async (releaseUrl: string) => {
    try {
      const response = await axios.get(releaseUrl);
      return Promise.resolve(response.data);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  /**
   * Fetch release markdown from github, return a promise string.
   *
   * If checkHasNewVersion is true, and isNeedPrompt is true, and hasPrompt is false, and getLatestReleaseInfo is success, then prompt user to update.
   */
  public async fetchReleaseMarkdown(): Promise<string | undefined> {
    const hasNewVersion = await this.checkHasNewVersion();
    console.warn(`---> has new version: ${hasNewVersion}`);
    this.storeCurrentVersionInfo();
    if (hasNewVersion && this.isNeedPrompt && !this.hasPrompt) {
      try {
        const latestReleaseInfo = await this.fetchLatestReleaseInfo(this.getReleaseTagUrl());
        if (latestReleaseInfo) {
          const latestReleaseBody = latestReleaseInfo.body;
          if (latestReleaseBody) {
            this.releaseMarkdown = latestReleaseBody;
            return Promise.resolve(latestReleaseBody);
          }
        }
      } catch (error) {
        console.error(`fetch release markdown error: ${error}`);
        return Promise.resolve(undefined);
      }
    }
    return Promise.resolve(undefined);
  }
}
