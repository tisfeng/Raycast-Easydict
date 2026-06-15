/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { Easydict } from "@/releaseVersion/versionInfo";

/**
 * Return a release Detail page with the markdown content.
 */
export default function ReleaseNotesPage() {
  const easydict = new Easydict();

  return (
    <Detail
      navigationTitle="Release Notes"
      markdown={easydict.releaseMarkdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser icon={Icon.Eye} title="View on GitHub" url={easydict.getCurrentReleaseTagUrl()} />
        </ActionPanel>
      }
    />
  );
}
