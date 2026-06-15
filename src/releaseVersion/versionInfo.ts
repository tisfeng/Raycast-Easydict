/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LocalStorage } from "@raycast/api";
import { logTrace } from "@/devLog";

const versionInfoKey = "EasydictVersionInfoKey";
const githubUrl = "https://github.com";

/**
 * Used for new release prompt.
 *
 * Todo: need to optimize the structure of this class.
 */
export class Easydict {
  static author = "tisfeng";
  static repo = "Raycast-Easydict";

  // * NOTE: this is new version info, don't use it directly. Use getCurrentStoredVersionInfo() instead.
  version = "2.11.3";
  isNeedPrompt = true;
  hasPrompted = false; // * always default false, only show once, then should be set to true.

  releaseMarkdown = `
## [v${this.version}]

### 💎 改进

- 优化类型安全。
- 更新依赖，提升稳定性

### 🐞 修复

- 移除密码字段的默认值，防止运行时类型不匹配。

---

### 💎 Improvement

- Improve type safety.
- Update dependencies and improve stability

### 🐞 Fixed

- Remove default values for password fields to prevent runtime type mismatch.

`;
  getRepoUrl() {
    return `${githubUrl}/${Easydict.author}/${Easydict.repo}`;
  }

  getReadmeUrl() {
    return `${githubUrl}/${Easydict.author}/${Easydict.repo}/#readme`;
  }

  getIssueUrl() {
    return `${githubUrl}/${Easydict.author}/${Easydict.repo}/issues`;
  }

  getCurrentReleaseTagUrl() {
    return `${this.getRepoUrl()}/releases/tag/${this.version}`;
  }

  chineseREADMEUrl = "https://github.com/tisfeng/Raycast-Easydict/blob/main/docs/README_ZH.md";

  /**
   * Chinese Wiki: https://github.com/tisfeng/Raycast-Easydict/wiki
   */
  public getChineseWikiUrl() {
    return `${this.getRepoUrl()}/wiki`;
  }

  /**
   * Store current version info.
   */
  private storeCurrentVersionInfo() {
    const jsonString = JSON.stringify(this);
    const currentVersionKey = `${versionInfoKey}-${this.version}`;
    return LocalStorage.setItem(currentVersionKey, jsonString);
  }

  /**
   * Manually hide prompt when viewed,, and store hasPrompted.
   */
  public hideReleasePrompt() {
    this.hasPrompted = true;
    return this.storeCurrentVersionInfo();
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
      return Promise.resolve(currentEasydictInfo);
    } else {
      const startStoredTime = Date.now();
      await this.storeCurrentVersionInfo();
      logTrace("version", `store version cost time: ${Date.now() - startStoredTime} ms`);
      logTrace("version", `store and get current version cost time: ${Date.now() - startTime} ms`);
      return Promise.resolve(this);
    }
  }

  /**
   * Get release markdown from local storage.
   */
  public async fetchReleaseMarkdown(): Promise<string> {
    const currentVersionInfo = await this.getCurrentVersionInfo();
    return Promise.resolve(currentVersionInfo.releaseMarkdown);
  }
}
