/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

export const userAgent =
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export const networkTimeout = 15000;

export const EASYDICT_VERSION = "2.11.3";

const GITHUB_REPO = "https://github.com/tisfeng/Raycast-Easydict";

export const FEEDBACK_URL = `${GITHUB_REPO}/issues`;

export function getReleaseTagUrl(version: string): string {
  return `${GITHUB_REPO}/releases/tag/${version}`;
}

export const RELEASE_MARKDOWN = `
## [v${EASYDICT_VERSION}]

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
