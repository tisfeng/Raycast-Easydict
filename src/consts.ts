/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getPreferenceValues } from "@raycast/api";
import os from "os";
import path from "path";

export const myPreferences = getPreferenceValues<Preferences>();

export const EASYDICT_TMP_DIR = path.join(os.tmpdir(), "raycast-easydict");

export const userAgent =
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export const networkTimeout = 15000;

export const EASYDICT_VERSION = "3.2.0";

const GITHUB_REPO = "https://github.com/tisfeng/Raycast-Easydict";

export const FEEDBACK_URL = `${GITHUB_REPO}/issues`;

export function getReleaseTagUrl(version: string): string {
  return `${GITHUB_REPO}/releases/tag/${version}`;
}

export const RELEASE_MARKDOWN = `
## [v${EASYDICT_VERSION}]

### ⚠️ Behavioral Changes

#### Reversible Legacy AI Migration

- OpenAI and Gemini preference-based providers are now labeled legacy.
- Manage Providers can import each configured legacy provider as a saved provider.
- Migration is reversible per provider: while its saved provider is absent, the legacy provider remains available under its existing preference/configuration; once the saved provider exists, it is not duplicated; deleting it restores the legacy provider, and the command can re-import it when offered.
- Manage Providers stores one order for built-in and AI providers; the Legacy Service List Order preference only initializes that order until it is saved.

### ✨ New Features

#### Configurable AI Providers

- Manage Providers supports Raycast AI and OpenAI-compatible providers alongside built-in dictionary and translation providers.
- All providers share one order; AI providers can be created, edited, tested, enabled or disabled, and duplicated, while built-in providers remain configured in Extension Settings.
- AI providers discover models automatically when available or accept a manual model name.
- The list identifies Built-in and AI Provider rows, shows enabled/disabled status (and Invalid for AI providers), and supports Cmd+Shift+Up/Down on macOS or Ctrl+Shift+Up/Down on Windows to reorder providers.
- Built-in presets include OpenAI, Gemini, DeepSeek, OpenRouter, SiliconFlow, Zhipu GLM, Kimi, MiniMax, Xiaomi MiMo, OpenCode Zen, and OpenCode Go.

#### AI-Generated Dictionary Entries

- For each provider, choose Plain Translation or AI-Generated Dictionary Entry in Word & Term Results.
- Dictionary mode applies to words and terms; other input remains plain translation. Some models may have structured-output compatibility issues, and dictionary generation may take longer.

---

<details>
<summary>Recent Updates [v3.1.0]</summary>

### ✨ New Features

- Added Favorite Words to save translation results and browse/manage them offline.
  - Thanks for @[TTsWorld](https://github.com/TTsWorld)

### 🔧 Maintenance

- Updated dependencies.

</details>

---

## [v${EASYDICT_VERSION}]

### ⚠️ 行为变更

#### 可逆的旧版 AI 配置迁移

- OpenAI 和 Gemini 偏好设置提供商现标记为旧版。
- 可通过 Manage Providers 将各个已配置的旧版提供商导入为独立的 AI Provider。
- 迁移按提供商独立且可逆：对应导入的 AI Provider 不存在时，旧版服务按原偏好设置/配置继续可用；导入后不会重复注册；删除对应 AI Provider 后旧版服务恢复，命令提供时可重新导入。
- Manage Providers 为内置提供商和 AI 提供商保存统一顺序；Legacy Service List Order 偏好设置仅在顺序保存前用于初始化。

### ✨ 新特性

#### 可配置的 AI Provider

- Manage Providers 支持 Raycast AI 和 OpenAI 兼容 AI 配置，以及内置词典和翻译提供商。
- 所有提供商共用统一顺序；AI 提供商支持创建、编辑、测试、启用或停用、复制，内置提供商仍在 Extension Settings 中配置。
- AI 提供商可在支持时自动发现模型，也可手动输入模型名称。
- 列表会标明 Built-in 或 AI Provider 类型，并显示 Enabled/Disabled 状态（AI 提供商还可能显示 Invalid）；可在 macOS 上使用 Cmd+Shift+Up/Down、Windows 上使用 Ctrl+Shift+Up/Down 调整提供商顺序。
- 内置预设包括 OpenAI、Gemini、DeepSeek、OpenRouter、SiliconFlow、Zhipu GLM、Kimi、MiniMax、小米 MiMo、OpenCode Zen 和 OpenCode Go。

#### AI 词典结果

- 每个配置都可在 Word & Term Results 中选择 Plain Translation 或 AI-Generated Dictionary Entry。
- 词典模式仅用于单词和术语，其他输入仍使用普通翻译；部分模型的结构化输出兼容性有限，生成词典结果可能耗时更长。

---

<details>
<summary>最近更新 [v3.1.0]</summary>

### ✨ 新特性

- 新增收藏单词，支持保存翻译结果并离线浏览和管理。
  - 感谢 @[TTsWorld](https://github.com/TTsWorld)

### 🔧 维护

- 更新项目依赖项。

</details>

---
`;
