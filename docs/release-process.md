# Release Process

This project keeps its source in `tisfeng/Raycast-Easydict` and publishes Store updates through pull requests to `raycast/extensions`.

## GitHub Configuration

Configure these values in the repository before using the publishing workflow:

- Secret `RAYCAST_EXTENSIONS_PAT`: a GitHub token that can push to your fork of `raycast/extensions` and create pull requests in `raycast/extensions`.
- Variable `RAYCAST_EXTENSIONS_FORK`: the fork that receives release branches, for example `tisfeng/extensions`.
- Variable `RAYCAST_GITHUB_USERNAME`: the GitHub user or organization used in the PR head, for example `tisfeng`.

The fork must already exist before the workflow runs.

## Prepare a Release

1. Update the top entry in `CHANGELOG.md`.
2. Update `src/releaseVersion/versionInfo.ts`:
   - `version` keeps the numeric version, for example `2.11.3`.
   - `versionDate` matches the top `CHANGELOG.md` date.
   - `releaseMarkdown` describes the same release.
3. Run local checks:

```bash
npm run release:check -- v2.11.3
npm run lint:ci
npm run build:ci
```

4. Create and push a `vX.Y.Z` tag.
5. Publish the matching GitHub Release.

Publishing the GitHub Release triggers `.github/workflows/publish-raycast-extension.yml`. The workflow validates the repository, copies this extension into `extensions/easydict` in the `raycast/extensions` checkout, pushes an `easydict-vX.Y.Z` branch to the configured fork, and opens or reuses a Raycast Store pull request titled `Update easydict to vX.Y.Z`.

## Pull Raycast Upstream Changes

Raycast reviewers may update files directly in `raycast/extensions`. `.github/workflows/sync-raycast-upstream.yml` checks for those changes daily and can also be run manually.

When upstream has changes, the workflow creates a branch named `sync/raycast-upstream-<sha>` and opens a pull request back to this repository. Merge that PR without extra edits so this repository stays aligned with the Store source.

## Manual Commands

The official Raycast CLI commands are still available:

```bash
npm run publish
npm run pull-contributions
```

Use them when a manual publish or contribution pull is simpler than running the GitHub workflow.
