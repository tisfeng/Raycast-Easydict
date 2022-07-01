/*
 * @author: tisfeng
 * @createTime: 2022-07-01 21:54
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-02 00:41
 * @fileName: releasePage.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useState } from "react";
import axios from "axios";

export function LatestReleasePage() {
  const [markdown, setMarkdown] = useState<string>();

  getReleaseMarkdown();

  async function getReleaseMarkdown() {
    try {
      const release = await getLatestRelease();
      setMarkdown(release.body);
    } catch (error) {
      console.error(`getReleaseMarkdown error: ${error}`);
    }
  }

  /**
   * Use axios to get github latest release, return a promise
   */
  const getLatestRelease = async () => {
    try {
      const url = `https://api.github.com/repos/tisfeng/Raycast-Easydict/releases/latest`;
      const response = await axios.get(url);
      return Promise.resolve(response.data);
    } catch (error) {
      console.log(`getGithubReleaseBody error: ${error}`);
      return Promise.reject(error);
    }
  };

  return (
    <Detail
      markdown={markdown}
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
