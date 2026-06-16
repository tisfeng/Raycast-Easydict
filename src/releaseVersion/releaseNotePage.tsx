/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useState } from "react";
import { Easydict } from "@/releaseVersion/versionInfo";

/**
 * Return a release Detail page with the markdown content.
 *
 * @fallbackMarkdown The placeholder markdown content before fetching from GitHub.
 */
export default function ReleaseNotesPage(props: { fallbackMarkdown?: string }) {
  console.log(`call ReleaseDetail function`);
  const easydict = new Easydict();

  const [releaseMarkdown, setReleaseMarkdown] = useState<string>(easydict.releaseMarkdown);

  easydict.fetchReleaseMarkdown().then((markdown) => {
    setReleaseMarkdown(markdown);
  });

  return (
    <Detail
      navigationTitle="Release Notes"
      markdown={releaseMarkdown || props.fallbackMarkdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser icon={Icon.Eye} title="View on GitHub" url={easydict.getCurrentReleaseTagUrl()} />
        </ActionPanel>
      }
    />
  );
}
