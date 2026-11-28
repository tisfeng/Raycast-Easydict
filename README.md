<p align="right">
  <a href="./README_ZH.md">中文</a> &nbsp;&nbsp;|&nbsp;&nbsp; English
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
      Originally developed by <a href="https://github.com/tisfeng">tisfeng</a>, currently maintained by
      <a href="https://github.com/maxchang3">maxchang3</a>.
    </em>
  </sup>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#integrations">Integrations</a> ·
  <a href="#supported-languages-and-services">Languages</a>
</p>

## Overview

**Raycast Easydict** is a clean, easy-to-use, **cross-platform dictionary and translation extension for Raycast** (supporting both macOS and Windows). It brings together traditional dictionaries, multi-engine machine translation, and AI-powered lookups and translation (via Raycast AI or any OpenAI-compatible endpoint) for fast everyday word lookups and text translation.

Beyond quick lookups, Raycast Easydict also doubles as a lightweight language-learning companion: save complete lookup results to favorites for review, inspect Chinese character stroke-order diagrams, or export your favorites to [Anki](https://apps.ankiweb.net/) for spaced-repetition practice.

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-1-1671806758.png" width="49%" />
  <img src="https://github.com/user-attachments/assets/268ced8a-1ba8-47f4-bee5-bc3af4987c7a" width="49%" />
</p>

<p>
  <sup>💡 <b>Looking for a native macOS app?</b> Try the standalone <a href="https://github.com/tisfeng/Easydict">Easydict App</a></sup>
</p>

## Features

**Look up and translate**

- 📦 **Out of the box**: Automatically detects input language and selects your preferred target language; supports automatic selected-text lookup (enabled by default) and cross-platform OCR screenshot translation.
- 🎨 **Rich dictionary results**: Displays translations, phonetics and audio pronunciation, exam tags, parts of speech, tenses and word forms, web phrases, and more.
- 🌐 **Multiple services in one place**:
  - **Dictionaries**: Built-in Youdao, Linguee, and Wiktionary dictionaries.
  - **Machine translation**: Supports DeepLX, Bing, DeepL, Google, Baidu, Volcano, Youdao, Caiyun, and 🍎 Apple System Translation (macOS only).
  - **🤖 AI lookup and translation**: Works with Raycast AI or any OpenAI-compatible endpoint; dictionary mode generates structured entries for words and terms.
- 🔊 **Auto pronunciation**: Automatically plays audio when looking up English words, preferring audio bundled with the result and falling back to Youdao pronunciation or system TTS.

**Learn and review**

- ✍️ **Stroke order**: View Chinese character stroke-order diagrams to aid memorization and writing.
- ⭐ **Favorite Words**: Save full snapshots of query results for offline browsing and management.
- 🧠 **Anki integration**: Export saved favorites to [Anki](https://apps.ankiweb.net/) via AnkiConnect for spaced-repetition review.

<details>
<summary><b>Screenshots</b></summary>

**Manage Providers**

<p align="center">
  <img src="https://github.com/user-attachments/assets/bace6248-bf41-4561-88c8-b6ba7e2b7ee2" width="49%" />
  <img src="https://github.com/user-attachments/assets/bb908545-5a5c-45f7-8712-4e3943dfa243" width="49%" />
</p>

**Favorite Words & Chinese Stroke Order**

<p align="center">
  <img src="https://github.com/user-attachments/assets/f6a39ed5-d3ae-46e5-bb35-d0645c278e15" width="49%" />
  <img src="https://github.com/user-attachments/assets/81b8154e-8d1b-4d2c-8665-92a3520f91da" width="49%" />
</p>

**Dictionary Details**

**Youdao Modern Chinese Dictionary**

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/xiaxi-1665674049.png" width="49%" />
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/yi-1665582552.png" width="49%" />
</p>

**[Linguee Dictionary](https://www.linguee.com/)**

| English ↔ Chinese | English ↔ French |
| --- | --- |
| ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-3-1666538642.png) | ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-3-1660916319.png) |
| ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/image-20220822170315915-1661158995.png) | ![](https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/image-20220822163332948-1661157213.png) |

**Show More Details (macOS `Cmd+M` / Windows `Ctrl+M`)**

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/showMore-1664440735.png" width="49%" />
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/uk-1666538447.png" width="49%" />
</p>

**Text Translation**

<p align="center">
  <img src="https://raw.githubusercontent.com/tisfeng/ImageBed/main/uPic/easydict-5-1663604001.png" width="49%" />
  <img src="https://github.com/user-attachments/assets/94e8f82d-c7b9-456e-b01f-d291926cfcac" width="49%" />
</p>

</details>

> If you find this extension helpful, please consider giving it a [Star](https://github.com/tisfeng/Raycast-Easydict) ⭐️!

## Installation

Easydict is an extension for [Raycast](https://www.raycast.com/), so you will need to install Raycast first (available on both macOS and Windows).

> [Raycast](https://www.raycast.com/) is a blazingly fast, totally extendable launcher. Like [Alfred](https://www.alfredapp.com/), its core features are completely free.

### Install from the Raycast Store

<a title="Install Easy Dictionary Raycast Extension" href="https://www.raycast.com/isfeng/easydict#install">
  <img width="256" style="width: 256px" src="https://assets.raycast.com/isfeng/easydict/install_button@2x.png" alt="Install Easy Dictionary Raycast Extension" />
</a>

### Build from Source

Requires Node.js 22.22.2 or later:

```bash
git clone https://github.com/tisfeng/Raycast-Easydict.git
cd Raycast-Easydict

npm install
npm run dev
```

## Quick Start

### Commands

Once installed, the extension provides 6 commands in Raycast:

| Command | Description | Platform |
| --- | --- | --- |
| **Search Word** | Main dictionary and translation view; type directly or auto-query selected text | macOS / Windows |
| **Search Selected Text** | Hotkey-oriented command for back-to-back selection lookups; always starts a fresh query | macOS / Windows |
| **OCR Translate** | Capture a screen region, recognize text locally with OCR, and translate it | macOS / Windows |
| **Select OCR Language** | Choose an installed Windows OCR language for OCR Translate | Windows only |
| **Favorite Words** | Browse and manage saved words offline, and export them to Anki | macOS / Windows |
| **Manage Providers** | Configure AI providers and reorder all services | macOS / Windows |

### Query Selected Text

**Query Selected Text Automatically** is enabled by default—opening **Search Word** automatically queries whatever text is selected in the frontmost app.

Depending on your workflow, assign a global hotkey (such as `Cmd+E`) to either command:

- **Assign to Search Word**: Select text and press your hotkey to look it up—great for occasional single lookups.
- **Assign to Search Selected Text** *(recommended for consecutive lookups)*: Reads the selection before Raycast takes focus and always replaces any search that is still open, whereas re-invoking **Search Word** while it is open may simply return to the previous search. If nothing is selected, it reopens the last query and restores any manually chosen target language.

### Shortcuts

| Action | View | macOS | Windows |
| --- | --- | --- | --- |
| Add / Remove from Favorites | Search Word | `Cmd+.` | `Ctrl+.` |
| Show More Details | Search Word | `Cmd+M` | `Ctrl+M` |
| Open Current Service in Browser (`Open in …`) | Search Word | `Cmd+O` | `Ctrl+O` |
| Read Query Text / Read Word | Search Word / Favorite Words | `Cmd+R` | `Ctrl+R` |
| Read Result Text | Search Word | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| Requery All Services | Search Word | `Cmd+Option+R` | `Ctrl+Alt+R` |
| Add to Anki | Favorite Words | `Cmd+Option+A` | `Ctrl+Shift+A` |
| Move Up / Move Down | Manage Providers | `Cmd+Option+Up/Down` | `Ctrl+Alt+Up/Down` |

## Configuration

Easydict works out of the box. You can customize the following options in **Extension Settings** or **Manage Providers** as needed.

### Preferred Languages and Target Language

Extension Settings provides two language preferences—**First Language** (defaults to Simplified Chinese) and **Second Language** (defaults to English)—which must be set to different languages. Together, they control:

- **More accurate language detection**: During automatic detection, First Language and Second Language are prioritized together as a pair over other languages, without strictly ranking First ahead of Second. For example, the English word `heel` is sometimes misidentified as Dutch; if English is one of your preferred languages, it will be recognized as English instead.
- **Automatic target language selection**: **Second Language** is used as the default target language; if the detected source language is your Second Language, **First Language** is used instead.
  - With the default settings (Simplified Chinese / English): Chinese → English, English → Simplified Chinese, and other languages such as Japanese or French → English.
- **Manual target language override**: Enable **Show Select Target Language** (off by default) in Extension Settings to temporarily pick another target language from the action panel.

### Providers and AI Services

Run **Manage Providers** to configure AI providers and control the display order of every service:

- **Ordering and enabling services**: Built-in dictionary and translation services can be enabled or disabled here; that choice overrides the matching Extension Settings checkbox for queries. API keys and other options stay in Extension Settings. Use **Follow Extension Settings** to clear an override. Use **Move Up** / **Move Down** to reorder any provider.
- **Connecting AI providers**: Supports **Raycast AI** and any **OpenAI-compatible endpoint**. Built-in presets cover popular providers (OpenAI, Gemini, DeepSeek, OpenRouter, SiliconFlow, Zhipu GLM, Kimi, MiniMax, Xiaomi MiMo, and more)—pick a preset, add your API key, and adjust the model if needed. Missing your provider? See the [contribution guide](https://github.com/tisfeng/Raycast-Easydict/blob/main/docs/development/adding-ai-provider.md).
- **AI dictionary mode**: Set **Word & Term Results** to either **Plain Translation** or **AI-Generated Dictionary Entry**. Dictionary mode builds a structured entry for words and terms (phonetics, definitions, examples, and word forms) while translating longer text normally. Because it produces structured output, responses can be slower and may occasionally require a retry.

<details>
<summary><b>Legacy settings migration (versions prior to v3.2.0)</b></summary>

- OpenAI and Gemini fields labeled **Legacy** in Extension Settings are retained only for migration or manual import and are no longer queried directly.
- Legacy settings with an API key migrate automatically the next time you open **Search Word**, **Search Selected Text**, **OCR Translate**, or **Manage Providers**, preserving connection settings, enabled state, and provider order.
- Choosing **Add from Legacy OpenAI/Gemini Settings…** in **Manage Providers** creates a separate AI provider copy from the old fields (initially disabled—enable it after saving). Editing or deleting it does not modify the legacy settings.

</details>

### Built-in Service Setup

Here is an overview of the default state and API key requirements for all built-in services:

| Service | Type | Enabled by Default | API Key | Notes |
| --- | --- | --- | --- | --- |
| Youdao Dictionary | Dictionary | ✅ | Not required | Simplified Chinese ↔ English, French, Japanese, Korean |
| Linguee Dictionary | Dictionary | ✅ | Not required | Bilingual definitions and examples across 19 languages |
| Wiktionary Dictionary | Dictionary | ❌ | Not required | Powered by English Wiktionary; great for less common pairs |
| DeepLX | Translation | ✅ | Not required | Free DeepL translation endpoint |
| Bing Translate | Translation | ✅ | Not required | Supports switching **Bing Host** in Extension Settings |
| Google Translate | Translation | ❌ | Not required | Requires a system proxy in mainland China |
| Youdao Translate | Translation | ❌ | Not required | Web endpoint; Simplified Chinese ↔ selected languages only |
| 🍎 Apple System Translation | Translation | ❌ | Not required | macOS only; requires a one-time Shortcuts setup |
| Caiyun Translate | Translation | ❌ | Optional (built-in test token) | Ready to try; [apply for your own token](https://bobtranslate.com/service/translate/caiyun.html) for regular use |
| DeepL | Translation | ❌ | Required | [Apply for a DeepL API Key](https://www.deepl.com/pro-api); supports custom **DeepL API URL** |
| Baidu Translate | Translation | ❌ | Required | [Apply for App ID and App Secret](https://bobtranslate.com/service/translate/baidu.html) |
| Volcano Translate | Translation / Detection | ❌ | Required | [Apply for Access Key](https://bobtranslate.com/service/translate/volcengine.html) |

> **Tip**: Caiyun Translate's built-in official test token is shared and rate-limited, so it may slow down or fail under heavy use. If you rely on it regularly, apply for your own key and set it in Extension Settings. Check each provider's website for current free-tier quotas.

### Auto-Play Word Pronunciation

**Play Word Pronunciation Automatically** is enabled by default and works as follows:

- Audio plays automatically only when the query is recognized as an English word or phrase (such as `good` or `look for`). Use **Read Query Text** to manually read any other input.
- **Audio fallback chain**: Prefers audio returned with the lookup result (from Youdao, Linguee, or Wiktionary); falls back to Youdao dictionary audio for English words without bundled audio, and to system TTS (macOS `say` / Windows Speech Synthesis) for other languages.
- When reading long text with system TTS, speech is truncated to the first 40 characters.

### Query Cache

Two independent local cache settings are available, both set to **Off** by default:

- **Query Cache**: Controls caching for built-in dictionary and machine translation results.
- **AI Query Cache**: Controls caching for AI translations and AI-generated dictionary entries.

**Modes and retention**

- **Off**: Do not cache results.
- **Words Only**: Cache only inputs identified as words or phrases.
- **All Text**: Cache all inputs, including sentences and longer text.
- **Expiration**: Built-in dictionary results are kept for up to **7 days**; machine translations, AI results, and confirmed language detection results are kept for up to **24 hours**.
- Language detection does not have a separate switch: confirmed detection results are cached whenever either cache setting permits caching the current input, and are not cached when both are **Off**.

**Managing cached results**

Cached results display a clock icon and can be controlled from the action panel:

- **Requery All Services**: Bypass existing cache, run fresh language detection, and query all enabled services.
- **Regenerate AI Result**: Regenerate output for the currently selected AI provider without affecting other services.
- **Clear Query Cache**: Clear cached dictionary, translation, AI, and language detection entries (shown only when at least one cache setting is enabled).

Fresh results obtained via requery or regeneration automatically replace cached entries when permitted by the active cache mode.

### System Proxy

Easydict does not have its own proxy toggle—all network requests follow Raycast's global proxy setting.

To route traffic through your system proxy, open **Raycast → Settings → Advanced → Connection** and enable **Use System Proxy Settings**. This is useful for accessing Google Translate in mainland China or working around IP rate limits on services like Linguee.

> Enabling a proxy can add network latency, so turn it on only when needed.

### Windows OCR Language

On Windows, **OCR Translate** uses the built-in Windows OCR engine and relies on OCR language packs installed on your system:

- Run **Select OCR Language** to inspect installed OCR languages and pin a specific language.
- The default **Automatic (Windows profile)** option initializes the engine with the first OCR-capable language in your Windows language list.
- To recognize additional languages, install the corresponding language packs in **Windows Settings → Time & language → Language & region**.

This command applies to Windows only and does not affect macOS (macOS uses the Apple Vision framework with automatic language detection).

## Integrations

### Anki

Export saved favorites to [Anki](https://apps.ankiweb.net/) via the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on (code `2055492159`) for spaced-repetition review.

- **Adding cards**: Keep Anki open, then select **Add to Anki** (macOS `Cmd+Option+A` / Windows `Ctrl+Shift+A`) or **Add All to Anki** from the action menu in **Favorite Words**. If Anki is closed, words are still saved to Favorites and can be sent later with **Add All to Anki**.
- **Card fields**: The front contains the word, phonetics, and audio (saved pronunciation is downloaded into Anki and auto-plays); the back contains translations and dictionary definitions. Words already in the deck are skipped automatically, and removing a favorite never deletes its Anki card so your review history stays intact.

**Anki settings**

- **Add Favorites to Anki Automatically**: Automatically send words to Anki when favorited (off by default).
- **Anki Deck**: Destination deck name (defaults to `Easydict`); created automatically along with an `Easydict` note type on first use.
- **AnkiConnect URL**: Endpoint for the AnkiConnect add-on (defaults to `http://127.0.0.1:8765`); update this if AnkiConnect uses a custom port or runs on another machine.

### PopClip (macOS only)

Install [PopClip](https://pilotmoon.com/popclip/) and assign a hotkey (for example `Cmd+E`) to **Search Word** (or **Search Selected Text**) to trigger Easydict directly from the PopClip popup.

Select the snippet below and click **Install "Easydict"** in PopClip:

```yaml
# popclip
name: Easydict
icon: search E
key combo: command E
```

> Reference: [PopClip Extension Snippets Examples](https://github.com/pilotmoon/PopClip-Extensions#extension-snippets-examples)

### Eudic

If [Eudic](https://www.eudic.net/v4/en/app/eudic) is installed on your computer, an **Open in Eudic App** action appears in the result action menu to open the current word in Eudic (supported on macOS and Windows; Windows requires Eudic to register the `eudic://` URL protocol).

To make it the primary action instead of **Copy Text**, enable **Show Open in Eudic First** in Extension Settings.

## Supported Languages and Services

<!-- automd:easydictLanguages locale="en" -->

Currently we support 49 languages: **Simplified Chinese, Traditional Chinese, English, Japanese, Korean, French, Spanish, Portuguese, Italian, German, Russian, Arabic, Swedish, Romanian, Thai, Slovak, Dutch, Hungarian, Greek, Danish, Finnish, Polish, Czech, Turkish, Lithuanian, Latvian, Ukrainian, Bulgarian, Indonesian, Malay, Slovenian, Estonian, Vietnamese, Persian, Hindi, Telugu, Tamil, Urdu, Filipino, Khmer, Lao, Bangla, Burmese, Norwegian, Georgian, Serbian, Croatian, Mongolian, Hebrew.**

<!-- /automd -->

### Language Detection

Easydict uses Bing, Baidu, and Volcano for remote language detection, with Franc as a local fallback:

- **Bing** and **Baidu** are enabled by default; **Volcano** can be enabled in Extension Settings (requires an Access Key).
- **Detect Language Speed First** is enabled by default and returns early as soon as a preferred language is matched. Turning it off waits for cross-checks across more services for higher accuracy, at the cost of extra latency.

<details>
<summary>Show language detection support matrix (49 languages)</summary>

<!-- automd:easydictDetectionTable locale="en" -->

| Languages | Bing | Baidu | Volcano |
| - | - | - | - |
| Simplified Chinese | ✅ | ✅ | ✅ |
| Traditional Chinese | ✅ | ✅ | ✅ |
| English | ✅ | ✅ | ✅ |
| Japanese | ✅ | ✅ | ✅ |
| Korean | ✅ | ✅ | ✅ |
| French | ✅ | ✅ | ✅ |
| Spanish | ✅ | ✅ | ✅ |
| Portuguese | ✅ | ✅ | ✅ |
| Italian | ✅ | ✅ | ✅ |
| German | ✅ | ✅ | ✅ |
| Russian | ✅ | ✅ | ✅ |
| Arabic | ✅ | ✅ | ✅ |
| Swedish | ✅ | ✅ | ✅ |
| Romanian | ✅ | ✅ | ✅ |
| Thai | ✅ | ✅ | ✅ |
| Slovak | ✅ | ✅ | ✅ |
| Dutch | ✅ | ✅ | ✅ |
| Hungarian | ✅ | ✅ | ✅ |
| Greek | ✅ | ✅ | ✅ |
| Danish | ✅ | ✅ | ✅ |
| Finnish | ✅ | ✅ | ✅ |
| Polish | ✅ | ✅ | ✅ |
| Czech | ✅ | ✅ | ✅ |
| Turkish | ✅ | ✅ | ✅ |
| Lithuanian | ✅ | ✅ | ✅ |
| Latvian | ✅ | ✅ | ✅ |
| Ukrainian | ✅ | ✅ | ✅ |
| Bulgarian | ✅ | ✅ | ✅ |
| Indonesian | ✅ | ✅ | ✅ |
| Malay | ✅ | ✅ | ✅ |
| Slovenian | ✅ | ✅ | ✅ |
| Estonian | ✅ | ✅ | ✅ |
| Vietnamese | ✅ | ✅ | ✅ |
| Persian | ✅ | ✅ | ✅ |
| Hindi | ✅ | ✅ | ✅ |
| Telugu | ✅ | ✅ | ✅ |
| Tamil | ✅ | ✅ | ✅ |
| Urdu | ✅ | ✅ | ✅ |
| Filipino | ✅ | ✅ | ✅ |
| Khmer | ✅ | ✅ | ✅ |
| Lao | ✅ | ✅ | ✅ |
| Bangla | ✅ | ✅ | ✅ |
| Burmese | ✅ | ✅ | ✅ |
| Norwegian | ✅ | ✅ | ✅ |
| Georgian | ✅ | ✅ | ✅ |
| Serbian | ✅ | ✅ | ✅ |
| Croatian | ✅ | ✅ | ✅ |
| Mongolian | ✅ | ❌ | ✅ |
| Hebrew | ✅ | ✅ | ✅ |

<!-- /automd -->

</details>

### Dictionaries

- **Youdao Dictionary**: Supports Simplified Chinese ↔ English, French, Japanese, and Korean. Does not support Traditional Chinese or direct lookups between non-Chinese languages.
- **Linguee Dictionary**: Supports 19 languages—Chinese, Japanese, and Russian pair only with English, while the remaining 16 languages (English, French, Spanish, Portuguese, Italian, German, Swedish, Romanian, Slovak, Dutch, Hungarian, Greek, Danish, Finnish, Polish, and Czech) can be looked up freely between one another.
- **Wiktionary Dictionary**: Free, keyless dictionary backed by [English Wiktionary](https://en.wiktionary.org/) (off by default; enable it in Extension Settings). Displays English definitions for non-English words and target-language translations for English words, including parts of speech, IPA pronunciation, recorded audio, word forms, and examples—handy for language pairs not covered by Linguee.

### Translation Services

Easydict includes DeepLX, Bing, DeepL, Google, Baidu, Volcano, Youdao, Caiyun, and macOS-only 🍎 Apple System Translation, and lets you add AI services such as Raycast AI, OpenAI, Gemini, and DeepSeek in **Manage Providers**.

See [Built-in Service Setup](#built-in-service-setup) for API keys and defaults, and [System Proxy](#system-proxy) for proxy configuration.

> **Google Translate**: The China site (`translate.google.cn`) is no longer available and requests now use the international endpoint (`translate.google.com`), which requires a system proxy in mainland China.
>
> **🍎 Apple System Translation**: macOS only; requires a one-time setup in the Shortcuts app. See [How to use macOS Apple System Translation in Easydict?](https://github.com/tisfeng/Raycast-Easydict/blob/main/docs/How-to-use-macOS%F0%9F%8D%8Esystem-translation-in-Easydict.md).

<details>
<summary>Show translation service support matrix (49 languages)</summary>

<!-- automd:easydictTranslationTable locale="en" -->

| Languages | Youdao | DeepL | DeepLX | Google | Bing | 🍎 Apple | Baidu | Volcano | Caiyun |
| - | - | - | - | - | - | - | - | - | - |
| Simplified Chinese | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Traditional Chinese | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| English | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Japanese | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Korean | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| French | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Spanish | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Portuguese | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Italian | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| German | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Russian | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Arabic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Swedish | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Romanian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Thai | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Slovak | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Dutch | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Hungarian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Greek | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Danish | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Finnish | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Polish | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Czech | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Turkish | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lithuanian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Latvian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Ukrainian | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Bulgarian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Indonesian | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Malay | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Slovenian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Estonian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Vietnamese | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Persian | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Hindi | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Telugu | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Tamil | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Urdu | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Filipino | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Khmer | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Lao | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Bangla | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Burmese | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Norwegian | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Georgian | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Serbian | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Croatian | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Mongolian | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Hebrew | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

<!-- /automd -->

</details>

> **Youdao Translate**: Supports Simplified Chinese ↔ English, Japanese, Korean, French, German, Russian, Spanish, Italian, Arabic, Dutch, and Thai only; Traditional Chinese is not supported.
>
> **Baidu Translate**: Some less common languages require an enterprise-verified premium plan. If a request fails, check the [official Baidu language list](https://ai.baidu.com/ai-doc/MT/4kqryjku9).

## Acknowledgements

- Inspired by [raycast-Parrot](https://github.com/Haojen/raycast-Parrot) and [Bob](https://github.com/ripperhe/Bob), with its initial version built on top of [raycast-Parrot](https://github.com/Haojen/raycast-Parrot). Easydict refines the UI, adds practical features, removes unnecessary complexity, and heavily optimizes performance.
- OCR Translate draws inspiration from [ScreenOCR](https://github.com/raycast/extensions/tree/main/extensions/screenocr):
  - Special thanks to [@aidevjoe](https://github.com/aidevjoe) for the original macOS implementation ([#41](https://github.com/tisfeng/Raycast-Easydict/pull/41)).
  - Special thanks to [@duckieeeduck](https://github.com/duckieeeduck) for the original Windows implementation ([raycast/extensions#30884](https://github.com/raycast/extensions/pull/30884)).

<p align="center">
  <a href="https://github.com/tisfeng/Raycast-Easydict/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=tisfeng/Raycast-Easydict" alt="Contributors" />
  </a>
</p>
