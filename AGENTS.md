# Raycast Easydict Extension Agent Guidelines

## Project Overview

### Key Context

- Integrates with multiple translation and dictionary providers (Linguee, Youdao, DeepL, Google, Bing, Baidu, Tencent, Volcano, OpenAI, Gemini, Apple System Translate, etc.).
- Provider response formats differ significantly. Maintain strict typing and provider-specific parsing logic.
- Uses Raycast-native UI components and follows Raycast UX conventions.
- API keys and credentials are managed through Raycast Preferences.
- Supports language detection, TTS, and audio playback.

## Agent Skills

Apply the `raycast-extension` skill when needed for UI components, Preferences, or standard Raycast extension architecture.

## Build & Verification

### Development

```bash
npm run dev
```

### Verification & Auto Fix

```bash
npm run fix-lint
```

Before completing a task:

1. Run relevant verification commands.
2. Ensure the extension still builds and functions correctly.
3. Report verification status in the final summary.

## Architecture Constraints

### Translation Providers

- Keep provider implementations isolated.
- Preserve provider-specific response types.
- Prefer following existing provider patterns.
- Avoid introducing shared abstractions unless multiple providers genuinely benefit.

### Raycast Integration

Prefer Raycast-native capabilities:

- Preferences API
- Cache API
- LocalStorage API
- Raycast UI components

Do not introduce alternative configuration, persistence, or state-management mechanisms without clear justification.

### UI Layer

- Use existing Raycast UI patterns.
- Maintain consistency with neighboring commands.
- Follow established loading, empty-state, metadata, and shortcut conventions.

## Code Guidelines

### Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful.

Keep commits atomic and bisectable. Every commit must build successfully, pass relevant tests, and leave the repository in a working state.

### Style Guide

- Keep logic close to its usage. Do not extract helpers unless they are reused, represent a clear abstraction boundary, or significantly improve readability.
- Avoid premature abstraction and over-engineering.
- Avoid defensive `try/catch` blocks. Prefer letting errors propagate unless recovery or error translation is required.
- Avoid using the `any` type.
- Rely on type inference when possible; avoid explicit type annotations unless necessary for exports, public APIs, or clarity.
- Prefer functional array methods (`map`, `filter`, `flatMap`) over loops where readability is not harmed.
- Use type guards with `filter` to preserve type inference downstream.
- Prefer `const` and arrow functions; avoid `let` and `function` unless reassignment or hoisting is required.

### Type Safety

- Do not manually define `Preferences` or `Arguments` interfaces.
- Use `getPreferenceValues<Preferences>()`; types are generated automatically in `raycast-env.d.ts`.
- Avoid unnecessary optional chaining (`?.`) and fallback operators (`??`, `||`) when values are guaranteed by schema or runtime constraints.

## Release Process

When creating a release:

1. Update `CHANGELOG.md` with the new version's changes.
2. Keep the `{PR_MERGE_DATE}` placeholder unchanged.
3. Update `version` and `releaseMarkdown` in `src/releaseVersion/versionInfo.ts`.
4. Ensure the version matches the changelog entry.
5. Commit and push the changes.

## Compact Instructions

Preserve:

1. Modified files
2. Key behavioral changes
3. Verification commands executed
4. Verification results
5. Open risks
6. TODO items
7. Release-related changes
8. Architecture decisions

Safe to summarize:

- General Raycast background
- Provider ecosystem descriptions
- Existing API documentation
- Low-frequency implementation details
