/*
 * @author: tisfeng
 * @createTime: 2022-07-01 21:54
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-03 01:51
 * @fileName: releaseDetail.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useState } from "react";
import { Easydict } from "./version";

export function ReleaseDetail() {
  const [releaseMarkdown, setReleaseMarkdown] = useState<string>("");

  const easydict = new Easydict();
  easydict.fetchReleaseMarkdown().then((markdown) => {
    if (markdown && markdown.length > 0) {
      setReleaseMarkdown(markdown);
    } else {
      console.error("Failed to fetch release markdown, use local stored markdown instead.");
      setReleaseMarkdown(easydict.releaseMarkdown);
    }
  });

  return (
    <Detail
      markdown={releaseMarkdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            icon={Icon.Globe}
            title="View Details on GitHub"
            url="https://github.com/tisfeng/Raycast-Easydict#readme"
          />
        </ActionPanel>
      }
    />
  );
}

export function MarkdownPage(props: { markdown: string }) {
  return (
    <Detail
      markdown={props.markdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            icon={Icon.Globe}
            title="View Details on GitHub"
            url="https://github.com/tisfeng/Raycast-Easydict#readme"
          />
        </ActionPanel>
      }
    />
  );
}
