# Raycast Easydict Extension Agent Guidelines

## Project Overview

**Key Context:**

- **Multiple Translation & Dictionary APIs:** Integrates with various APIs (Linguee, Youdao, DeepL, Google, Bing, Baidu, Tencent, Volcano, OpenAI, Gemini, Apple System Translate, etc.). Ensure robust error handling and type safety when parsing API responses from different providers.
- **UI/UX Consistency:** Relies strictly on Raycast UI components (`List`, `ActionPanel`, `Detail`). Adheres to Raycast's design patterns (e.g., loading states, empty views, metadata, shortcuts).
- **Authentication & Data:** Manages user API Keys and App IDs securely via Raycast Preferences. Uses Raycast's built-in preference and caching mechanisms instead of custom implementations.
- **Multi-language Support:** Handles automatic language detection, text-to-speech (TTS), and audio playback.

## Agent Skills

Apply the `raycast-extension` skill when needed for UI components, Preferences, or standard Raycast extension architecture.

## Code Guidelines

### Type Safety

- **TypeScript Interfaces for Preferences:** Do not manually define `Preferences` or `Argument` interfaces. Use `getPreferenceValues<Preferences>()` as types are auto-generated in `raycast-env.d.ts` by Raycast.
- **Strict Schema Usage:** Do not add unnecessary optional chaining (`?.`) or fallback operators (`??`, `||`).

## Release Process

When creating a new release:

1. **Update CHANGELOG.md** with the new version's changes (keep the date placeholder `{PR_MERGE_DATE}` — Raycast auto-fills it on merge)

2. **Update `version` and `releaseMarkdown`** in `src/releaseVersion/versionInfo.ts` (must match CHANGELOG.md for this version)

3. **Commit and push**
