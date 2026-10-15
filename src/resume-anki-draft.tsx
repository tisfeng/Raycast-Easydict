import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useEffect, useState } from "react";

import { plainText } from "@/core/content/markdown";
import CaptureForm from "@/features/anki/CaptureForm";
import type { CaptureDraft } from "@/features/anki/model";
import { loadRecentDraft } from "@/features/anki/storage";

type ResumeState =
  | { kind: "loading" | "empty" }
  | { kind: "ready"; key: string; draft: CaptureDraft }
  | { kind: "error"; message: string };
export default function ResumeAnkiDraft() {
  const [state, setState] = useState<ResumeState>({ kind: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadRecentDraft()
      .then((recent) => {
        if (active) setState(recent ? { kind: "ready", ...recent } : { kind: "empty" });
      })
      .catch((error) => {
        if (active)
          setState({ kind: "error", message: error instanceof Error ? error.message : "Could not restore the draft." });
      });
    return () => {
      active = false;
    };
  }, [retry]);
  if (state.kind === "ready") return <CaptureForm initial={state.draft} resumeKey={state.key} />;
  return (
    <Detail
      isLoading={state.kind === "loading"}
      markdown={
        state.kind === "error"
          ? plainText(state.message)
          : state.kind === "loading"
            ? "Loading your Anki draft…"
            : "No unsent Anki draft. Start a new capture to add a word."
      }
      actions={
        <ActionPanel>
          <Action.Push title="New Capture" icon={Icon.Plus} target={<CaptureForm />} />
          <Action
            title="Reload Draft"
            icon={Icon.ArrowClockwise}
            onAction={() => {
              setState({ kind: "loading" });
              setRetry((value) => value + 1);
            }}
          />
        </ActionPanel>
      }
    />
  );
}
