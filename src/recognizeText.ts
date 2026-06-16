/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { execa, ExecaError } from "execa";
import { join } from "path";
import { chmod } from "fs/promises";

const recognizeText = async () => {
  const command = join(environment.assetsPath, "recognizeText");
  await chmod(command, "755");
  try {
    // Maybe user has not installed Xcode(swift), https://github.com/raycast/extensions/pull/6613#issuecomment-1560785710
    // const filePath = join(environment.assetsPath, "recognizeText.swift");
    // const { stdout } = await execa("swift", [filePath]);
    const { stdout } = await execa(command);
    return stdout;
  } catch (error) {
    if ((error as ExecaError).stdout === "No text selected") {
      return undefined;
    } else {
      throw error;
    }
  }
};

export { recognizeText };
