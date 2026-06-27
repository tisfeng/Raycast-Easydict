# Raycast Easydict Extension Agent Guidelines

## Project Overview

### Key Context

- Integrates with multiple translation and dictionary providers (Linguee, Youdao, DeepL, DeepLX, Google, Bing, Baidu, Tencent, Volcano, Caiyun, OpenAI, Gemini, Apple System Translate, etc.).
- Provider response formats differ significantly. Maintain strict typing and provider-specific parsing logic.
- Uses Raycast-native UI components and follows Raycast UX conventions.
- API keys and credentials are managed through Raycast Preferences.
- Supports language detection, TTS, and audio playback.

## Agent Skills

Apply the `raycast-extension` skill when needed for UI components, Preferences, or standard Raycast extension architecture.

Skills are managed via `skills-lock.json`. Each entry records the GitHub source, skill path, and integrity hash. Developers sync skills with:

```bash
npx skills experimental_install
```

## Build & Verification

### Development

```bash
npm run dev
```

### Verification & Auto Fix

```bash
npx tsc --noEmit        # TypeScript type check
npm run fix-lint         # ESLint auto-fix
npm run build            # Build verification
```

Before completing a task:

1. Run the verification commands above in sequence.
2. Ensure the extension still builds and functions correctly.
3. Report verification status in the final summary.

## Architecture Constraints

### Translation Providers

Three provider categories, each with an abstract base class using the **template method pattern**:

- **`BaseTranslateProvider`** — public `request()` (AsyncGenerator), abstract `doTranslate()`. Non-streaming providers are auto-wrapped.
- **`BaseDetectProvider`** — public `detect()`, abstract `doDetect()`.
- **`BaseDictionaryProvider`** — public `request()`, abstract `doQuery()`.

Base classes handle timer instrumentation and error normalization (`handleRequestError`); subclasses focus on API logic only.

Each category has a **static registry** in its `index.ts` — declarative arrays of `{ type, preference, provider }` configs. Provider classes are instantiated by the engine, not at module load.

OpenAI-compatible providers (in the `openai-compatible/` directory) share a common `base.ts` for streaming protocol and endpoint/model/key configuration.

- Keep provider implementations isolated — no cross-provider dependencies.
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

### Core Domain (`src/core/`)

- `query/` — `queryReducer` with typed actions (`START_QUERY`, `SET_RESULT`, `CLEAR_ALL`, etc.), display section computation, and cross-service coupling rules.
- `audio/` — download, play, TTS, and query audio handling.
- `detect/` — language detection utilities and types.
- `language/` — language constants, types, and utility functions.

The core layer is decoupled from UI and providers. Providers produce raw results; core transforms them into display-ready sections.

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

### Error Handling

- Provider subclasses never catch errors — base classes wrap via `handleRequestError`.
- Use `RequestError` and `CancelledError` from `@/utils/errors` for typed error shapes.
- Use `normalizeError` to convert unknown errors (FetchError, APICallError, generic) into consistent types.
- Use `showErrorToast` / `showFailureToast` for user-facing error notifications.

### Imports

- All imports use `@/` alias for cross-module references (e.g. `@/types`, `@/dictionary/youdao/types`).
- Same-directory imports use `./` relative paths when the module is only used within that directory.

### Type Safety

- Do not manually define `Preferences` or `Arguments` interfaces.
- Use `getPreferenceValues<Preferences>()`; types are generated automatically in `raycast-env.d.ts`.
- Avoid unnecessary optional chaining (`?.`) and fallback operators (`??`, `||`) when values are guaranteed by schema or runtime constraints.
- Do not use `as unknown as` double-cast hacks. Type incompatibilities must be resolved through proper type alignment.
- Do not use the `any` type. Use `unknown` and narrow with type guards when the type is genuinely unknown.

## Release Process

When creating a release:

1. Update `CHANGELOG.md` with the new version's changes.
2. Keep the `{PR_MERGE_DATE}` placeholder unchanged.
3. Update `EASYDICT_VERSION` and `RELEASE_MARKDOWN` in `src/consts.ts`.
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
