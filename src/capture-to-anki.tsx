import { Detail, getSelectedText, type LaunchProps, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";

import CaptureForm from "@/features/anki/CaptureForm";
import { type CaptureDraft, emptyDraft } from "@/features/anki/model";
import { decodeDraft } from "@/features/anki/storage";

type InitialCapture = { draft: CaptureDraft; direction: string } | { error: string };

function readCaptureContext(value: unknown): InitialCapture | undefined {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== "object" ||
    !("captureDraft" in value) ||
    !("captureDirection" in value) ||
    typeof value.captureDirection !== "string"
  ) {
    return { error: "Invalid capture handoff. Reopen Add to Anki from the dictionary; no draft was changed." };
  }
  try {
    return {
      draft: decodeDraft(JSON.stringify({ version: 2, draft: value.captureDraft })),
      direction: value.captureDirection,
    };
  } catch {
    return { error: "Invalid capture handoff. Reopen Add to Anki from the dictionary; no draft was changed." };
  }
}

export default function CaptureToAnki({
  launchContext,
}: Pick<LaunchProps<{ launchContext: Record<string, unknown> }>, "launchContext"> = {}) {
  const [initial, setInitial] = useState<InitialCapture | undefined>(() => readCaptureContext(launchContext));
  useEffect(() => {
    // A dictionary handoff already contains the user's selected meaning. Do not
    // read the newly focused app or clipboard again when promoting the form.
    if (initial !== undefined) return;
    let active = true;
    getSelectedText()
      .then((value) => {
        if (active) setInitial({ draft: emptyDraft(value.trim()), direction: "" });
      })
      .catch(() => {
        if (!active) return;
        setInitial({ draft: emptyDraft(), direction: "" });
        void showToast({
          style: Toast.Style.Success,
          title: "Enter a Word Manually",
          message: "Selected text was unavailable. No clipboard was read.",
        });
      });
    return () => {
      active = false;
    };
  }, []);
  if (!initial) return null;
  if ("error" in initial) return <Detail markdown={initial.error} />;
  return <CaptureForm initial={initial.draft} direction={initial.direction} />;
}
