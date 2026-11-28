# Raycast Easydict

Support macOS and Windows. Guard platform-specific APIs, paths, and shells. Check changed Raycast API usage against the installed `@raycast/api` and `@raycast/utils` types. For unclear platform, manifest, or runtime behavior, consult the [Raycast docs](https://developers.raycast.com/llms.txt).

## Verification

- For code changes, run `npm run lint`, `npm test`, and `npm run build` on the final implementation. The build includes type checking.
- For UI, shortcut, or lifecycle changes, use `npm run dev` to verify the affected flow in Raycast on relevant platforms. Report native checks you could not run. For launch, input, selection, or shortcut bugs, see [Debugging Raycast behavior](docs/development/debugging-raycast.md).
- For docs-only changes, check formatting, links, and `git diff --check`. Report skipped code checks.
- Test observable behavior and invariants through the affected entry point, such as a Raycast command or repository method. Name tests for the scenario and expected outcome. Prefer mocking external boundaries such as Raycast APIs, network requests, and OS processes. Exercise the real parsing, caching, and migration code when testing those behaviors. Demonstrate regression tests fail before the fix and pass afterward.

## Code conventions

- Use `@/` imports across modules and relative imports within a directory. Prefer inferred types. Narrow `unknown`. Do not use `any` or `as unknown as`.
- Use generated `Preferences` and `Arguments` from `raycast-env.d.ts` and `getPreferenceValues<Preferences>()`. Rely on manifest-guaranteed values without fallbacks.
- Group actions by purpose and frequency. Raycast assigns default shortcuts to the first two actions. Preserve primary and secondary actions, shortcuts, and root navigation unless intentionally changing them.

## Architecture and behavior

Preserve upgrade paths for data and settings from released versions. Replace superseded interfaces and formats used only in branch testing directly, without compatibility layers, fallbacks, or migrations for those intermediate versions.

- **Providers.** Decode payloads per provider. Translation and dictionary providers return semantic content. Detectors report observations for `core/detect` to resolve per query. Share protocol helpers only across consumers. Base methods own timing, cancellation, and final error normalization. Subclasses catch only for protocol recovery or conversion to typed errors.
- **Errors.** Use `RequestError` and `CancelledError` for provider failures, `normalizeError` for unknown errors, and `showErrorToast` or `showFailureToast` at the UI boundary.
- **Queries.** `QueryRunner` owns requests and results. The UI reads its state synchronously. Preserve cancellation. Only the current request for a service may publish updates, write cache entries, or clear loading. Cache hits skip provider calls. Explicit requery and regeneration bypass the cache. Requests started before a cache clear cannot refill it.
- **Results.** Keep result contracts independent of provider payloads, profiles, and rendering. Preserve discriminated unions and stored enum values. Compose visibility and supplements without mutating per-service results or caches. Render Markdown at the detail or page boundary. Keep UI identities, cache markers, and comparison Markdown out of snapshots.
- **AI profiles.** Static settings and credentials use Raycast Preferences. Dynamic profiles and credentials use the profile repository’s encrypted `LocalStorage`. Preserve saved profiles across migrations. Keep configuration independent of React and share `useAIProviderProfiles` across UIs. Profiles own translation/dictionary routing. Dictionary providers own prompts, parsing, and payloads.
- **Favorites.** Save composed content and service metadata independently of settings and query cache. Isolate legacy display types within favorites. Serialize mutations against freshly read data. Read the old key only if the new key is absent. An empty new collection is authoritative. The first explicit mutation saves the entire converted collection and retains the old key. Back up invalid data before explicit recovery. Keep future versions read-only.

## Documentation and releases

- For user-facing features or breaking changes, update `README.md` and the corresponding maintained content in `README_ZH.md`. Keep Features brief and put setup, defaults, and retention under Configuration.
- Keep each Markdown paragraph or list item on one physical line. Preserve code block and table structure. Regenerate `<!-- automd -->` blocks with `npm run docs:gen`.
- Keep each commit to one logical change. Use `type(scope): summary` for commit and PR titles. Allowed types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`.
- When committing a correction to your own unpushed commit, fold it into that commit. Rewrite pushed history only with explicit permission.
- Base changelog entries on unreleased, user-visible changes in the net diff against the actual PR target (normally `origin/main`). Group presets and supporting fixes with their feature unless independently user-visible. Specify migration, deprecation, and fallback conditions, including reversibility.
- Use `## [vX.Y.Z] - {PR_MERGE_DATE}` for new entries. Keep the placeholder and omit an `Unreleased` section. Update `EASYDICT_VERSION` and `RELEASE_MARKDOWN` only during explicit [release preparation](docs/development/releasing.md#release-steps). Commit or push release changes only when requested.
