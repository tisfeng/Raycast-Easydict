/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getPreferenceValues } from "@raycast/api";
import os from "os";
import path from "path";

export const myPreferences = getPreferenceValues<Preferences>();

export const EASYDICT_TMP_DIR = path.join(os.tmpdir(), "raycast-easydict");

export const userAgent =
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export const networkTimeout = 15000;

export const EASYDICT_VERSION = "3.0.0";

const GITHUB_REPO = "https://github.com/tisfeng/Raycast-Easydict";

export const FEEDBACK_URL = `${GITHUB_REPO}/issues`;

export function getReleaseTagUrl(version: string): string {
  return `${GITHUB_REPO}/releases/tag/${version}`;
}

export const RELEASE_MARKDOWN = `
## [v${EASYDICT_VERSION}]

### ✨ 新特性

- Windows 平台支持（包含原生的 TTS 语音朗读与跨平台音频播放能力）
- 新增繁体中文作为 DeepL 目标语言支持
- 新增偏好设置：支持隐藏语言选择和标题中的国家/地区 emoji

### 💎 改进

#### 架构与重构

- 全面重构底层架构（规范查询引擎、API Provider 及目录结构），引入模板方法模式和声明式的服务解耦，提高代码的可维护性与扩展性
- 重构并解耦音频模块（统一管理下载、播放与语音合成逻辑）
- 精简项目依赖（如移除 \`file-type\`、\`crypto-js\`），通过自行实现等量功能进一步减小插件体积

#### 功能优化

- 优化 OpenAI 翻译提示词
- 将「播放文本」重命名为「朗读文本」，并更新对应快捷键（\`Cmd+R\` / \`Cmd+Shift+R\`）
- 优化有道词典的数据格式化逻辑以及 Linguee 的 HTML 解析算法

### 🐞 修复

- 修复应用从后台恢复时，搜索文本偶发闪烁或重新出现的历史遗留问题
- 修复必应翻译在并发查询及特定情况下递归过深导致的查询失败与结果竞态问题
- 修复部分词典连续播放音频时可能产生的播放冲突与缓存覆盖问题
- 修复格鲁吉亚语出现在目标语言选项中但实际无法查询的问题

---

### ✨ New Features

- Added full support for Windows platform (including native TTS voice reading and cross-platform audio playback capabilities).
- Added Traditional Chinese as a supported target language for DeepL.
- Added preference option to hide country/region emojis in language selection and titles.

### 💎 Improvement

#### Architecture & Refactoring

- Completely refactored the underlying architecture (standardized query engine, API providers, and directory structure), introducing the template method pattern and declarative service decoupling to improve code maintainability and scalability.
- Refactored and decoupled the audio module (unified management of download, playback, and voice synthesis logic).
- Streamlined project dependencies (e.g., removed \`file-type\`, \`crypto-js\`), further reducing the plugin size by implementing equivalent functionalities natively.

#### Functional Optimization

- Optimized OpenAI translation prompts.
- Renamed "Play Text" to "Read Text" and updated corresponding shortcuts (\`Cmd+R\` / \`Cmd+Shift+R\`).
- Optimized Youdao dictionary data formatting logic and Linguee HTML parsing algorithm.

### 🐞 Fixed

- Fixed a legacy issue where the search text would occasionally flicker or reappear when the app resumed from the background.
- Fixed an issue where Bing translation would fail due to excessive recursion in specific cases and result in race conditions during concurrent queries.
- Fixed a playback conflict and cache overwrite issue that could occur during continuous audio playback for some dictionaries.
- Fixed an issue where Georgian appeared in the target language options but could not actually be queried.

`;
