/*
 * @author: tisfeng
 * @createTime: 2022-07-01 19:05
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-03 17:42
 * @fileName: version.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";
import axios from "axios";
import { requestCostTime } from "../request";

const versionInfoKey = "EasydictVersionInfoKey";
const githubUrl = "https://github.com";
const githubApiUrl = "https://api.github.com";

export class Easydict {
  static author = "tisfeng";
  static repo = "Raycast-Easydict";

  // new version info
  // static currentInfo = new Easydict("1.1.0", 3, "2022-07-01", true, false, "");

  // * NOTE: new version info, don't use it directly. Use getCurrentStoredVersionInfo() instead.
  version = "1.1.0";
  buildNumber = 3;
  versionDate = "2022-07-01";
  isNeedPrompt = true;
  hasPrompted = false; // only show once, then will be set to true
  releaseMarkdown = "Release Markdown";

  // version: string;
  // buildNumber: number;
  // versionDate: string;
  // isNeedPrompt: boolean;
  // hasPrompt: boolean;
  // releaseMarkdown: string;

  // constructor(
  //   version: string,
  //   buildNumber: number,
  //   versionDate: string,
  //   isNeedPrompt: boolean,
  //   hasPrompt: boolean,
  //   releaseMarkdown: string
  // ) {
  //   this.version = version;
  //   this.buildNumber = buildNumber;
  //   this.versionDate = versionDate;
  //   this.isNeedPrompt = isNeedPrompt;
  //   this.hasPrompt = hasPrompt;
  //   this.releaseMarkdown = releaseMarkdown;
  // }

  getRepoUrl() {
    return `${githubUrl}/${Easydict.author}/${Easydict.repo}`;
  }

  getReadmeUrl() {
    return `${githubUrl}/${Easydict.author}/${Easydict.repo}/#readme`;
  }

  getIssueUrl() {
    return `${githubUrl}/${Easydict.author}/${Easydict.repo}/issues`;
  }

  /**
   * 项目中文介绍 https://github.com/tisfeng/Raycast-Easydict/wiki
   */
  public getChineseWikiUrl() {
    return `${this.getRepoUrl()}/wiki`;
  }

  /**
   *  Release tag url: /repos/{owner}/{repo}/releases/tags/{tag}
   *  https://api.github.com/repos/tisfeng/Raycast-Easydict/releases/tags/1.1.0
   */
  public getReleaseApiUrl() {
    return `${githubApiUrl}/repos/${Easydict.author}/${Easydict.repo}/releases/tags/${this.version}`;
  }

  /**
   * Get current version info, return a promise EasydictInfo.
   */
  // async getCurrentStoredVersionInfo(): Promise<Easydict> {
  //   const startTime = Date.now();
  //   const currentVersionKey = `${versionInfoKey}-${this.version}`;
  //   const currentVersionInfo = await this.getVersionInfo(currentVersionKey);
  //   if (currentVersionInfo) {
  //     console.log(`get current stored version cost time: ${Date.now() - startTime} ms`);
  //     return Promise.resolve(currentVersionInfo);
  //   } else {
  //     const startStoredTime = Date.now();
  //     await this.storeCurrentVersionInfo();
  //     console.log(`store version cost time: ${Date.now() - startStoredTime} ms`);
  //     console.log(`store and get current stored version cost time: ${Date.now() - startTime} ms`);
  //     return Promise.resolve(this);
  //   }
  // }

  /**
   * Store current version info.
   */
  private storeCurrentVersionInfo() {
    const jsonString = JSON.stringify(this);
    const currentVersionKey = `${versionInfoKey}-${this.version}`;
    return LocalStorage.setItem(currentVersionKey, jsonString);
  }

  /**
   * Remove current version info.
   */
  removeCurrentVersionInfo() {
    const currentVersionKey = `${versionInfoKey}-${this.version}`;
    LocalStorage.removeItem(currentVersionKey);
  }

  /**
   * Get version info with version key, return a promise EasydictInfo.
   */
  async getVersionInfo(versionKey: string): Promise<Easydict | undefined> {
    const jsonString = await LocalStorage.getItem<string>(versionKey);
    if (!jsonString) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(JSON.parse(jsonString));
  }

  /**
   * Get current version info, return a promise EasydictInfo.
   */
  async getCurrentVersionInfo(): Promise<Easydict> {
    const startTime = Date.now();
    const currentVersionKey = `${versionInfoKey}-${this.version}`;
    const currentEasydictInfo = await this.getVersionInfo(currentVersionKey);
    if (currentEasydictInfo) {
      // console.log(`get current easydict cost time: ${Date.now() - startTime} ms`);
      return Promise.resolve(currentEasydictInfo);
    } else {
      const startStoredTime = Date.now();
      await this.storeCurrentVersionInfo();
      console.log(`store version cost time: ${Date.now() - startStoredTime} ms`);
      console.log(`store and get current version cost time: ${Date.now() - startTime} ms`);
      return Promise.resolve(this);
    }
  }

  /**
   * Check if need store current version info.
   */
  // private async checkHasNewVersion(): Promise<boolean> {
  //   const storedVersionInfo = await this.getCurrentStoredVersionInfo();
  //   if (storedVersionInfo) {
  //     const currentVersion = parseFloat(this.version);
  //     const storedVersion = parseFloat(storedVersionInfo.version);
  //     const hasNewVersion = currentVersion > storedVersion;
  //     return Promise.resolve(hasNewVersion);
  //   } else {
  //     this.storeCurrentVersionInfo();
  //   }
  //   return Promise.resolve(true);
  // }

  /**
   * Fetch release markdown, return a promise string.
   * First, fetech markdown from github, if failed, then read from localStorage.
   *
   * * NOTE: if fetch markdown from github success, then will store `this`(Easydict) to localStorage.
   */
  public async fetchReleaseMarkdown(): Promise<string | undefined> {
    try {
      console.log("fetch release markdown from github");
      const releaseInfo = await this.fetchReleaseInfo(this.getReleaseApiUrl());
      if (releaseInfo) {
        const releaseBody = releaseInfo.body;
        console.log("fetch release markdown from github success");
        if (releaseBody) {
          this.releaseMarkdown = releaseBody;
          this.storeCurrentVersionInfo();
          return Promise.resolve(releaseBody);
        }
      }
    } catch (error) {
      console.error(`fetch release markdown error: ${error}`);
      const currentVersionInfo = await this.getCurrentVersionInfo();
      console.log(`use local storaged markdown : ${currentVersionInfo?.version}`);
      return Promise.resolve(currentVersionInfo?.releaseMarkdown);
    }
  }

  /**
   * Use axios to get github latest release, return a promise
   */
  public fetchReleaseInfo = async (releaseUrl: string) => {
    try {
      // console.log(`fetch release url: ${releaseUrl}`);
      const response = await axios.get(releaseUrl);
      console.log(`fetch github cost time: ${response.headers[requestCostTime]} ms`);

      return Promise.resolve(response.data);
    } catch (error) {
      return Promise.reject(error);
    }
  };
}
