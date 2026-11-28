<p align="right">
  中文 &nbsp;&nbsp;|&nbsp;&nbsp; <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/Raycast-Easydict/main/assets/extension-icon.png" width="128" alt="Raycast Easydict icon" />
</p>

<h1 align="center">Raycast Easydict</h1>

<p align="center">
  Easily look up words or translate text
</p>

<p align="center">
  <a title="Install Easy Dictionary Raycast Extension" href="https://www.raycast.com/isfeng/easydict#install">
    <img width="256" style="width: 256px" src="https://assets.raycast.com/isfeng/easydict/install_button@2x.png" alt="Install Easy Dictionary Raycast Extension" />
  </a>
</p>

<p align="right">
  <sup>
    <em>
      原作者为 <a href="https://github.com/tisfeng">tisfeng</a>，目前由
      <a href="https://github.com/maxchang3">maxchang3</a> 维护。
    </em>
  </sup>
</p>

<p align="center">
  <a href="#核心特性">核心特性</a> ·
  <a href="#安装">安装</a> ·
  <a href="#快速上手">快速上手</a> ·
  <a href="#配置指南">配置指南</a> ·
  <a href="#生态集成">生态集成</a> ·
  <a href="#支持的语言与服务详情">支持语言</a>
</p>

## 简介

**Raycast Easydict** 是一款简洁易用的**跨平台 Raycast 词典与翻译扩展**（支持 macOS 与 Windows），整合传统词典、多引擎机器翻译以及 AI 查词与翻译（支持 Raycast AI 及任意 OpenAI 兼容接口），满足日常快速查词与文本翻译需求。

除了查词和翻译，Raycast Easydict 也可以作为一款轻量的语言学习工具：你可以将完整查询结果加入收藏以便复习，查看汉字笔顺图，或一键导出到 [Anki](https://apps.ankiweb.net/)，通过间隔重复巩固记忆。

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-1-1671806758.png" width="49%" />
  <img src="https://github.com/user-attachments/assets/268ced8a-1ba8-47f4-bee5-bc3af4987c7a" width="49%" />
</p>

<p>
  <sup>💡 <b>寻找 macOS 原生应用？</b> 试试独立的 <a href="https://github.com/tisfeng/Easydict">Easydict App</a></sup>
</p>

## 核心特性

**查词与翻译**

- 📦 **开箱即用**：自动识别输入语种并匹配偏好目标语言；支持划词自动查询（默认开启）与跨平台 OCR 截图翻译。
- 🎨 **丰富的词典信息**：涵盖译文、音标与发音、考试词频、词性释义、时态与词形变化、网络短语等。
- 🌐 **多服务聚合**：
  - **词典**：内置有道词典、Linguee 词典与 Wiktionary 词典。
  - **机器翻译**：支持 DeepLX、Bing、DeepL、Google、百度、火山、有道、彩云小译，以及 🍎 苹果系统翻译（仅 macOS）。
  - **🤖 AI 查词与翻译**：支持 Raycast AI 及任意 OpenAI 兼容端点，开启词典模式可为单词和词组生成结构化词条。
- 🔊 **自动播放发音**：查询英文单词时自动朗读；优先播放结果自带音频，无自带音频时回退到有道词典发音或系统 TTS。

**学习与复习**

- ✍️ **汉字笔顺**：支持查看汉字笔顺图，辅助记忆与书写。
- ⭐ **收藏单词**：保存完整查询结果快照，支持离线浏览与管理。
- 🧠 **Anki 联动**：通过 AnkiConnect 将收藏单词导入 [Anki](https://apps.ankiweb.net/)，借助间隔重复高效复习。

<details>
<summary><b>界面截图</b></summary>

**管理 Provider**

<p align="center">
  <img src="https://github.com/user-attachments/assets/bace6248-bf41-4561-88c8-b6ba7e2b7ee2" width="49%" />
  <img src="https://github.com/user-attachments/assets/bb908545-5a5c-45f7-8712-4e3943dfa243" width="49%" />
</p>

**收藏单词与汉字笔顺**

<p align="center">
  <img src="https://github.com/user-attachments/assets/f6a39ed5-d3ae-46e5-bb35-d0645c278e15" width="49%" />
  <img src="https://github.com/user-attachments/assets/81b8154e-8d1b-4d2c-8665-92a3520f91da" width="49%" />
</p>

**词典详情**

**有道 - 现代汉语词典**

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/xiaxi-1665674049.png" width="49%" />
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/yi-1665582552.png" width="49%" />
</p>

**[Linguee 词典](https://www.linguee.com/)**

| 英语 ↔ 中文 | 英语 ↔ 法语 |
| --- | --- |
| ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-3-1666538642.png) | ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-3-1660916319.png) |
| ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/image-20220822170315915-1661158995.png) | ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/image-20220822163332948-1661157213.png) |

**查看更多（macOS `Cmd+M` / Windows `Ctrl+M`）**

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/showMore-1664440735.png" width="49%" />
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/uk-1666538447.png" width="49%" />
</p>

**文本翻译结果**

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-5-1663604001.png" width="49%" />
  <img src="https://github.com/user-attachments/assets/94e8f82d-c7b9-456e-b01f-d291926cfcac" width="49%" />
</p>

</details>

> 如果觉得这个扩展有帮助，欢迎给个 [Star](https://github.com/tisfeng/Raycast-Easydict) ⭐️ 支持一下！

## 安装

Easydict 是基于 [Raycast](https://www.raycast.com/) 的扩展，使用前请先安装 Raycast（同时支持 macOS 与 Windows）。

> [Raycast](https://www.raycast.com/) 是一款响应迅速、高度可扩展的启动器，与 [Alfred](https://www.alfredapp.com/) 类似，核心功能完全免费。

### 从 Raycast 商店安装

<a title="Install Easy Dictionary Raycast Extension" href="https://www.raycast.com/isfeng/easydict#install">
  <img width="256" style="width: 256px" src="https://assets.raycast.com/isfeng/easydict/install_button@2x.png" alt="Install Easy Dictionary Raycast Extension" />
</a>

### 从源码构建

需要 Node.js 22.22.2 或更高版本：

```bash
git clone https://github.com/tisfeng/Raycast-Easydict.git
cd Raycast-Easydict

npm install
npm run dev
```

## 快速上手

### 命令一览

安装完成后，可在 Raycast 中使用以下 6 个命令：

| 命令 | 说明 | 平台 |
| --- | --- | --- |
| **Search Word** | 主查词与翻译入口，支持直接输入或自动查询当前选中文本 | macOS / Windows |
| **Search Selected Text** | 专为连续划词设计的快捷键命令，始终发起新查询 | macOS / Windows |
| **OCR Translate** | 框选屏幕区域进行本地 OCR 识别并自动翻译 | macOS / Windows |
| **Select OCR Language** | 选择本机已安装的 Windows OCR 识别语言 | 仅 Windows |
| **Favorite Words** | 离线浏览与管理已收藏单词，支持导出至 Anki | macOS / Windows |
| **Manage Providers** | 配置 AI Provider，并自定义所有服务的展示顺序 | macOS / Windows |

### 划词查询

**Query Selected Text Automatically** 默认开启，唤起 **Search Word** 时会自动查询当前最前窗口中的选中文本。

根据使用习惯，建议为以下任一命令绑定全局快捷键（如 `Cmd+E`）：

- **绑定 Search Word**：选中文本后按下快捷键即可查词，适合单次查阅。
- **绑定 Search Selected Text**（推荐连续划词场景）：该命令会在 Raycast 抢占焦点前读取选中文本，并始终用新内容替换当前查询；相比之下，在窗口未关闭时再次唤起 **Search Word** 可能只回到上一次结果。若当前未选中任何文本，它会重新打开上一次查询，并恢复当时手动选定的目标语言。

### 常用快捷键

| 操作 | 适用页面 | macOS | Windows |
| --- | --- | --- | --- |
| 收藏 / 取消收藏（Add / Remove from Favorites） | Search Word | `Cmd+.` | `Ctrl+.` |
| 查看更多详情（Show More Details） | Search Word | `Cmd+M` | `Ctrl+M` |
| 在网页中打开当前服务（Open in …） | Search Word | `Cmd+O` | `Ctrl+O` |
| 朗读查询文本（Read Query Text / Read Word） | Search Word / Favorite Words | `Cmd+R` | `Ctrl+R` |
| 朗读结果文本（Read Result Text） | Search Word | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| 重新查询所有服务（Requery All Services） | Search Word | `Cmd+Option+R` | `Ctrl+Alt+R` |
| 添加到 Anki（Add to Anki） | Favorite Words | `Cmd+Option+A` | `Ctrl+Shift+A` |
| 上移 / 下移服务顺序（Move Up / Move Down） | Manage Providers | `Cmd+Option+Up/Down` | `Ctrl+Alt+Up/Down` |

## 配置指南

Easydict 开箱即用，以下设置可按需在扩展设置（Extension Settings）或 **Manage Providers** 中调整。

### 偏好语言与目标语言

扩展设置中的两项偏好语言为 **First Language**（第一语言，默认简体中文）和 **Second Language**（第二语言，默认英语），两者不可相同。它们共同决定以下行为：

- **提升语种自动识别准确度**：识别输入语种时，First Language 与 Second Language 会作为一个整体优先于其他语种，不按第一、第二区分先后。例如英语单词 `heel` 容易被部分服务误判为荷兰语，只要两项偏好语言中包含英语，就会优先判定为英语。
- **自动确定目标翻译语言**：默认使用 **Second Language** 作为目标语言；当检测到的源语言恰好为 Second Language 时，自动切换为 **First Language**。
  - 例如在默认设置（简体中文 / 英语）下：中文 → 英语，英语 → 简体中文，日语、法语等其他语种 → 英语。
- **手动临时指定目标语言**：在扩展设置中开启 **Show Select Target Language**（默认关闭）后，即可在查询结果的操作面板中临时切换目标语言。

### 管理 Provider 与 AI 服务

运行 **Manage Providers** 命令，即可统一管理 AI Provider 以及所有内置服务的展示顺序：

- **服务排序与启用**：内置词典与翻译服务可在此启用或停用；该选择会覆盖扩展设置中对应的开关，用于查询。API Key 及其他选项仍在扩展设置。用 **Follow Extension Settings** 可清除覆盖。使用 **Move Up** / **Move Down** 调整位置。
- **连接 AI 服务**：支持 **Raycast AI** 与任意 **OpenAI 兼容接口**。扩展已内置常见服务商预设（OpenAI、Gemini、DeepSeek、OpenRouter、SiliconFlow、Zhipu GLM、Kimi、MiniMax、Xiaomi MiMo 等），选中后填入 API Key 并按需调整模型即可；如需补充其他预设，欢迎参考[贡献指南](https://github.com/tisfeng/Raycast-Easydict/blob/main/docs/development/adding-ai-provider.md)。
- **AI 词典模式**：在 **Word & Term Results** 中可选择 **Plain Translation**（纯翻译）或 **AI-Generated Dictionary Entry**（AI 词典词条）。开启词典模式后，查询单词和词组会生成包含音标、释义、例句和词形变化的结构化词条，其余长文本仍按普通翻译处理。由于需要生成结构化数据，响应速度会相对较慢，偶发格式异常时可能需要重试。

<details>
<summary><b>旧版设置迁移说明（v3.2.0 之前版本）</b></summary>

- 扩展设置中标有 **Legacy** 的 OpenAI / Gemini 字段仅作为迁移或手动导入来源，不再直接参与查询。
- 填有 API Key 的旧版设置会在下次打开 **Search Word**、**Search Selected Text**、**OCR Translate** 或 **Manage Providers** 时自动迁移，并保留原有连接配置、启用状态与排序。
- 在 **Manage Providers** 中选择 **Add from Legacy OpenAI/Gemini Settings…** 可按旧配置新建一份独立的 AI Provider 副本（默认停用，保存后需手动启用）；编辑或删除该副本不会影响旧版设置。

</details>

### 翻译与词典服务配置

内置服务的默认启用状态及密钥要求如下：

| 服务 | 类型 | 默认开启 | 密钥要求 | 说明 |
| --- | --- | --- | --- | --- |
| 有道词典 | 词典 | ✅ | 无需密钥 | 支持简中与英/法/日/韩互查 |
| Linguee 词典 | 词典 | ✅ | 无需密钥 | 支持 19 种语言的双语例句与释义 |
| Wiktionary 词典 | 词典 | ❌ | 无需密钥 | 基于英文维基词典，适合小语种 |
| DeepLX | 翻译 | ✅ | 无需密钥 | 免费 DeepL 翻译接口 |
| Bing 翻译 | 翻译 | ✅ | 无需密钥 | 支持在扩展设置中切换 **Bing Host** |
| Google 翻译 | 翻译 | ❌ | 无需密钥 | 国内使用需开启系统代理 |
| 有道翻译 | 翻译 | ❌ | 无需密钥 | 使用网页接口，仅支持简中与部分语种互译 |
| 🍎 苹果系统翻译 | 翻译 | ❌ | 无需密钥 | 仅 macOS，需先配置一次「快捷指令」 |
| 彩云小译 | 翻译 | ❌ | 可选（内置测试 Token） | 可直接试用，建议[申请自己的 Token](https://bobtranslate.com/service/translate/caiyun.html) |
| DeepL | 翻译 | ❌ | 需自备密钥 | [申请 DeepL API Key](https://www.deepl.com/pro-api)，支持自定义 **DeepL API URL** |
| 百度翻译 | 翻译 | ❌ | 需自备密钥 | [申请 App ID 与 App Secret](https://bobtranslate.com/service/translate/baidu.html) |
| 火山翻译 | 翻译 / 语种识别 | ❌ | 需自备密钥 | [申请 Access Key](https://bobtranslate.com/service/translate/volcengine.html) |

> **提示**：彩云小译内置的官方共享测试 Token 存在频率限制，多人同时使用时可能变慢或失败；如经常使用，建议申请个人密钥并在扩展设置中替换。各服务商的免费额度政策请以官方最新说明为准。

### 自动播放单词发音

**Play Word Pronunciation Automatically** 默认开启，满足以下条件时会自动发音：

- 仅当输入被识别为单词或短语（如 `good`、`look for`）且源语言为英语时自动播放；其他文本可通过 **Read Query Text** 手动朗读。
- **音频优先级**：优先播放查询结果自带的音频（来自有道、Linguee 或 Wiktionary）；英文单词无自带音频时回退到有道词典发音；其他语种则调用系统 TTS（macOS `say` / Windows 语音合成）。
- 使用系统 TTS 朗读长文本时，内容会截断至前 40 个字符。

### 查询缓存

扩展提供两项独立的本地缓存开关，默认均为 **Off**：

- **Query Cache**：控制内置词典与机器翻译结果的缓存。
- **AI Query Cache**：控制 AI 翻译结果与 AI 词典词条的缓存。

**可选模式与有效期**

- **Off**：不缓存结果。
- **Words Only**：仅缓存识别为单词或词组的输入。
- **All Text**：缓存所有输入，包括句子及更长文本。
- **有效期**：内置词典结果最长保留 **7 天**；机器翻译、AI 结果及已确认的语种识别结果最长保留 **24 小时**。
- 语种识别不设单独开关：只要上述两项缓存中任一项覆盖当前输入，已确认的语种识别结果便会一并缓存；两者均为 **Off** 时则不缓存。

**缓存管理**

命中缓存的结果会显示时钟图标，可通过操作面板进行以下控制：

- **Requery All Services**：跳过现有缓存，重新识别语种并请求所有已启用服务。
- **Regenerate AI Result**：仅使用当前选中的 AI Provider 重新生成结果，不影响其他服务。
- **Clear Query Cache**：清空所有词典、翻译、AI 及语种识别缓存（仅在至少开启一项缓存时显示）。

通过重新查询或重新生成获取的新结果，若符合当前缓存策略，会自动覆盖旧缓存。

### 系统代理

Easydict 不设独立代理开关，所有网络请求统一遵循 Raycast 的全局代理设置。

如需使用代理，请前往 **Raycast → Settings → Advanced → Connection**，开启 **Use System Proxy Settings**。这在国内使用 Google 翻译，或遇到 Linguee 等服务的 IP 频率限制时非常实用。

> 开启系统代理可能会增加请求延迟，建议仅在需要时启用。

### Windows OCR 语言

在 Windows 上，**OCR Translate** 调用系统内置的 Windows OCR 引擎，依赖本机已安装的 OCR 语言包：

- 运行 **Select OCR Language** 可查看本机可用的 OCR 语言并手动指定识别语言。
- 默认选项 **Automatic (Windows profile)** 会依据 Windows 语言列表，自动选用第一个支持 OCR 的语言。
- 如需识别其他语言，请前往 **Windows 设置 → 时间和语言 → 语言和区域** 安装对应语言包。

此设置仅作用于 Windows，不影响 macOS（macOS 使用 Apple Vision 框架并自动检测识别语言）。

## 生态集成

### Anki

收藏单词可通过 [AnkiConnect](https://ankiweb.net/shared/info/2055492159) 插件（插件代码 `2055492159`）同步到 [Anki](https://apps.ankiweb.net/)，利用间隔重复巩固记忆。

- **添加卡片**：保持 Anki 处于打开状态，在 **Favorite Words** 的操作菜单中选择 **Add to Anki**（macOS `Cmd+Option+A` / Windows `Ctrl+Shift+A`）或 **Add All to Anki**。若当时 Anki 未运行，单词仍会保存在本地收藏中，后续随时可用 **Add All to Anki** 补发。
- **卡片内容**：正面包含单词、音标与发音（收藏中保存的音频会下载至 Anki 并自动播放），背面包含译文与词典释义。牌组中已存在的单词会自动跳过；在扩展中取消收藏不会删除 Anki 内已有卡片，复习进度得以保留。

**相关扩展设置**

- **Add Favorites to Anki Automatically**：收藏单词时自动同步至 Anki（默认关闭）。
- **Anki Deck**：目标牌组名称（默认 `Easydict`），首次使用时会自动创建该牌组及 `Easydict` 笔记类型。
- **AnkiConnect URL**：AnkiConnect 监听地址（默认 `http://127.0.0.1:8765`），使用自定义端口或连接其他设备时按需修改。

### PopClip（仅 macOS）

安装 [PopClip](https://pilotmoon.com/popclip/) 并为 **Search Word**（或 **Search Selected Text**）绑定快捷键（例如 `Cmd+E`）后，即可在划词弹窗中一键调用 Easydict。

选中以下代码块，点击 PopClip 弹出的「安装 Easydict」即可完成配置：

```yaml
# popclip
name: Easydict
icon: search E
key combo: command E
```

> 参考：[PopClip Extension Snippets Examples](https://github.com/pilotmoon/PopClip-Extensions#extension-snippets-examples)

### 欧路词典

如果本机已安装[欧路词典](https://www.eudic.net/v4/en/app/eudic)，查询结果的操作菜单中会自动出现 **Open in Eudic App**，点击即可跳转到欧路词典查看该词（支持 macOS 与 Windows；Windows 需由欧路词典注册 `eudic://` 协议）。

如需将其设为默认第一项操作（默认第一项为 **Copy Text**），可在扩展设置中开启 **Show Open in Eudic First**。

## 支持的语言与服务详情

<!-- automd:easydictLanguages locale="zh" -->

目前总计支持 49 种语言：**简体中文，繁体中文，英语，日语，韩语，法语，西班牙语，葡萄牙语，意大利语，德语，俄语，阿拉伯语，瑞典语，罗马尼亚语，泰语，斯洛伐克语，荷兰语，匈牙利语，希腊语，丹麦语，芬兰语，波兰语，捷克语，土耳其语，立陶宛语，拉脱维亚语，乌克兰语，保加利亚语，印度尼西亚语，马来语，斯洛文尼亚语，爱沙尼亚语，越南语，波斯语，印地语，泰卢固语，泰米尔语，乌尔都语，菲律宾语，高棉语，老挝语，孟加拉语，缅甸语，挪威语，格鲁吉亚语，塞尔维亚语，克罗地亚语，蒙古语，希伯来语。**

<!-- /automd -->

### 语种识别

Easydict 使用 Bing、百度和火山三种远程语种识别服务，并以本地库 Franc 作为兜底：

- 默认启用 **Bing** 和 **百度**；**火山**可在扩展设置中按需启用（需填写 Access Key）。
- 默认开启 **Detect Language Speed First**（速度优先），命中偏好语言时会提前返回结果；关闭该选项可等待更多服务交叉校验以提升准确度，但响应耗时也会相应增加。

<details>
<summary>展开查看各语种识别服务的支持列表（49 种语言）</summary>

<!-- automd:easydictDetectionTable locale="zh" -->

| 语言 | Bing | 百度 | 火山 |
| - | - | - | - |
| 简体中文 | ✅ | ✅ | ✅ |
| 繁体中文 | ✅ | ✅ | ✅ |
| 英语 | ✅ | ✅ | ✅ |
| 日语 | ✅ | ✅ | ✅ |
| 韩语 | ✅ | ✅ | ✅ |
| 法语 | ✅ | ✅ | ✅ |
| 西班牙语 | ✅ | ✅ | ✅ |
| 葡萄牙语 | ✅ | ✅ | ✅ |
| 意大利语 | ✅ | ✅ | ✅ |
| 德语 | ✅ | ✅ | ✅ |
| 俄语 | ✅ | ✅ | ✅ |
| 阿拉伯语 | ✅ | ✅ | ✅ |
| 瑞典语 | ✅ | ✅ | ✅ |
| 罗马尼亚语 | ✅ | ✅ | ✅ |
| 泰语 | ✅ | ✅ | ✅ |
| 斯洛伐克语 | ✅ | ✅ | ✅ |
| 荷兰语 | ✅ | ✅ | ✅ |
| 匈牙利语 | ✅ | ✅ | ✅ |
| 希腊语 | ✅ | ✅ | ✅ |
| 丹麦语 | ✅ | ✅ | ✅ |
| 芬兰语 | ✅ | ✅ | ✅ |
| 波兰语 | ✅ | ✅ | ✅ |
| 捷克语 | ✅ | ✅ | ✅ |
| 土耳其语 | ✅ | ✅ | ✅ |
| 立陶宛语 | ✅ | ✅ | ✅ |
| 拉脱维亚语 | ✅ | ✅ | ✅ |
| 乌克兰语 | ✅ | ✅ | ✅ |
| 保加利亚语 | ✅ | ✅ | ✅ |
| 印度尼西亚语 | ✅ | ✅ | ✅ |
| 马来语 | ✅ | ✅ | ✅ |
| 斯洛文尼亚语 | ✅ | ✅ | ✅ |
| 爱沙尼亚语 | ✅ | ✅ | ✅ |
| 越南语 | ✅ | ✅ | ✅ |
| 波斯语 | ✅ | ✅ | ✅ |
| 印地语 | ✅ | ✅ | ✅ |
| 泰卢固语 | ✅ | ✅ | ✅ |
| 泰米尔语 | ✅ | ✅ | ✅ |
| 乌尔都语 | ✅ | ✅ | ✅ |
| 菲律宾语 | ✅ | ✅ | ✅ |
| 高棉语 | ✅ | ✅ | ✅ |
| 老挝语 | ✅ | ✅ | ✅ |
| 孟加拉语 | ✅ | ✅ | ✅ |
| 缅甸语 | ✅ | ✅ | ✅ |
| 挪威语 | ✅ | ✅ | ✅ |
| 格鲁吉亚语 | ✅ | ✅ | ✅ |
| 塞尔维亚语 | ✅ | ✅ | ✅ |
| 克罗地亚语 | ✅ | ✅ | ✅ |
| 蒙古语 | ✅ | ❌ | ✅ |
| 希伯来语 | ✅ | ✅ | ✅ |

<!-- /automd -->

</details>

### 词典服务

- **有道词典**：支持简体中文 ↔ 英语、法语、日语、韩语；不支持繁体中文，也不支持非中文语种之间的直接互查。
- **Linguee 词典**：支持 19 种语言——中文、日语、俄语仅支持与英语互查；英语、法语、西班牙语、葡萄牙语、意大利语、德语、瑞典语、罗马尼亚语、斯洛伐克语、荷兰语、匈牙利语、希腊语、丹麦语、芬兰语、波兰语、捷克语这 16 种语言之间支持任意互查。
- **Wiktionary 词典**：基于[英文维基词典](https://en.wiktionary.org/)的免费免密钥词典服务（默认关闭，可在扩展设置中启用）。查询非英语单词时提供英文释义，查询英语单词时提供目标语言译文，涵盖词性、IPA 音标、真人发音、词形变化与例句，适合补充 Linguee 未覆盖的语言对。

### 翻译服务

Easydict 内置 DeepLX、Bing、DeepL、Google、百度、火山、有道、彩云小译以及仅限 macOS 的 🍎 苹果系统翻译；同时可在 **Manage Providers** 中添加 Raycast AI、OpenAI、Gemini、DeepSeek 等 AI 翻译服务。

密钥申请与开关说明详见[翻译与词典服务配置](#翻译与词典服务配置)，代理设置详见[系统代理](#系统代理)。

> **Google 翻译**：中国站（`translate.google.cn`）已不可用，目前统一使用国际版（`translate.google.com`），国内使用需开启系统代理。
>
> **🍎 苹果系统翻译**：仅支持 macOS，首次使用前需在「快捷指令」中完成一次配置，详见[如何在 Easydict 中使用 macOS 苹果系统翻译？](https://github.com/tisfeng/Raycast-Easydict/blob/main/docs/%E5%A6%82%E4%BD%95%E5%9C%A8Easydict%E4%B8%AD%E4%BD%BF%E7%94%A8macOS%F0%9F%8D%8E%E7%B3%BB%E7%BB%9F%E7%BF%BB%E8%AF%91.md)。

<details>
<summary>展开查看各翻译服务的支持列表（49 种语言）</summary>

<!-- automd:easydictTranslationTable locale="zh" -->

| 语言 | 有道翻译 | DeepL | DeepLX | Google 翻译 | Bing 翻译 | 🍎 系统翻译 | 百度翻译 | 火山翻译 | 彩云小译 |
| - | - | - | - | - | - | - | - | - | - |
| 简体中文 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 繁体中文 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 英语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 日语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 韩语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 法语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 西班牙语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 葡萄牙语 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 意大利语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 德语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 俄语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 阿拉伯语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 瑞典语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 罗马尼亚语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 泰语 | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 斯洛伐克语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 荷兰语 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 匈牙利语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 希腊语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 丹麦语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 芬兰语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 波兰语 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 捷克语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 土耳其语 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 立陶宛语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 拉脱维亚语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 乌克兰语 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 保加利亚语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 印度尼西亚语 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 马来语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 斯洛文尼亚语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 爱沙尼亚语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 越南语 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 波斯语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 印地语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 泰卢固语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 泰米尔语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 乌尔都语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 菲律宾语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 高棉语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 老挝语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 孟加拉语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 缅甸语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 挪威语 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 格鲁吉亚语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 塞尔维亚语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 克罗地亚语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 蒙古语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| 希伯来语 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

<!-- /automd -->

</details>

> **有道翻译**：仅支持简体中文与英语、日语、韩语、法语、德语、俄语、西班牙语、意大利语、阿拉伯语、荷兰语、泰语互译，不支持繁体中文。
>
> **百度翻译**：部分非常见语种仅对企业认证的尊享版开放；如调用报错，请以[百度官方语种列表](https://ai.baidu.com/ai-doc/MT/4kqryjku9)为准。

## 致谢

- 本项目的灵感源于 [raycast-Parrot](https://github.com/Haojen/raycast-Parrot) 和 [Bob](https://github.com/ripperhe/Bob)，初始版本基于 [raycast-Parrot](https://github.com/Haojen/raycast-Parrot) 开发。Easydict 在其基础上重新打磨了 UI 交互，新增了大量实用功能，精简了冗余操作，并进行了深度的性能优化。
- OCR 截图翻译功能的实现参考了 [ScreenOCR](https://github.com/raycast/extensions/tree/main/extensions/screenocr)：
  - 特别感谢 [@aidevjoe](https://github.com/aidevjoe) 贡献的 macOS 版原始实现（[#41](https://github.com/tisfeng/Raycast-Easydict/pull/41)）。
  - 特别感谢 [@duckieeeduck](https://github.com/duckieeeduck) 贡献的 Windows 版原始实现（[raycast/extensions#30884](https://github.com/raycast/extensions/pull/30884)）。

<p align="center">
  <a href="https://github.com/tisfeng/Raycast-Easydict/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=tisfeng/Raycast-Easydict" alt="Contributors" />
  </a>
</p>
