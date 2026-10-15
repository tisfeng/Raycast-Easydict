import { Action, Icon, launchCommand, LaunchType } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useRef } from "react";

import { shortcuts } from "@/shared/shortcuts";

import type { CaptureDraft } from "./model";

/** Open a regular command so the form does not inherit Search Word's hotkey launch context. */
export default function CaptureAction({ initial, direction = "" }: { initial: CaptureDraft; direction?: string }) {
  const launching = useRef(false);
  return (
    <Action
      title="Add to Anki"
      icon={Icon.Plus}
      shortcut={shortcuts.addToAnki}
      onAction={async () => {
        if (launching.current) return;
        launching.current = true;
        try {
          await launchCommand({
            name: "capture-to-anki",
            type: LaunchType.UserInitiated,
            context: { captureDraft: initial, captureDirection: direction },
          });
        } catch (error) {
          await showFailureToast(error, { title: "Could Not Open Anki Capture" });
        } finally {
          launching.current = false;
        }
      }}
    />
  );
}
