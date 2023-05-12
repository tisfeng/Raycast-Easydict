import { environment } from "@raycast/api";
import { join } from "path";
import { execa, ExecaError } from "execa";
import { chmod } from "fs/promises";

const recognizeText = async () => {
  const command = join(environment.assetsPath, "RecognizeText");
  await chmod(command, "755");

  try {
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
