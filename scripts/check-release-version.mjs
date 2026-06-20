#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function normalizeVersion(value) {
  return value.replace(/^v/, "");
}

function fail(messages) {
  for (const message of messages) {
    console.error(`release:check: ${message}`);
  }
  process.exit(1);
}

const explicitTag =
  process.argv[2] ||
  process.env.RELEASE_TAG ||
  (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "");

const changelog = readFile("CHANGELOG.md");
const versionInfo = readFile("src/releaseVersion/versionInfo.ts");

const changelogMatch = changelog.match(/^##\s+\[v?(\d+\.\d+\.\d+)\]\s+-\s+(.+)$/m);
const versionMatch = versionInfo.match(/^\s*version\s*=\s*"([^"]+)";/m);
const versionDateMatch = versionInfo.match(/^\s*versionDate\s*=\s*"([^"]+)";/m);

const errors = [];

if (!changelogMatch) {
  errors.push("could not find the first version heading in CHANGELOG.md, expected `## [vX.Y.Z] - YYYY-MM-DD`");
}

if (!versionMatch) {
  errors.push('could not find `version = "X.Y.Z";` in src/releaseVersion/versionInfo.ts');
}

if (!versionDateMatch) {
  errors.push('could not find `versionDate = "YYYY-MM-DD";` in src/releaseVersion/versionInfo.ts');
}

if (errors.length > 0) {
  fail(errors);
}

const changelogVersion = changelogMatch[1];
const changelogDate = changelogMatch[2].trim();
const versionInfoVersion = normalizeVersion(versionMatch[1]);
const versionInfoDate = versionDateMatch[1];

if (explicitTag) {
  if (!/^v\d+\.\d+\.\d+$/.test(explicitTag)) {
    errors.push(`tag must use vX.Y.Z format, got ${explicitTag}`);
  } else if (normalizeVersion(explicitTag) !== changelogVersion) {
    errors.push(`tag ${explicitTag} does not match CHANGELOG.md version v${changelogVersion}`);
  }
}

if (versionInfoVersion !== changelogVersion) {
  errors.push(`versionInfo.ts version ${versionInfoVersion} does not match CHANGELOG.md version ${changelogVersion}`);
}

if (changelogDate !== "{PR_MERGE_DATE}" && versionInfoDate !== changelogDate) {
  errors.push(`versionInfo.ts versionDate ${versionInfoDate} does not match CHANGELOG.md date ${changelogDate}`);
}

if (errors.length > 0) {
  fail(errors);
}

const checkedTag = explicitTag || `v${changelogVersion}`;
console.log(`release:check passed for ${checkedTag}`);
