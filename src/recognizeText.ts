/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { x } from "tinyexec";
import { join } from "path";
import { chmod } from "fs/promises";

const recognizeText = async () => {
  const command = join(environment.assetsPath, "recognizeText");
  await chmod(command, "755");
  const result = await x(command);
  return result.stdout.trim();
};

export { recognizeText };
