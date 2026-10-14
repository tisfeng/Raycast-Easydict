import { getSelectedText, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";

import CaptureForm from "@/features/anki/CaptureForm";
import { emptyDraft } from "@/features/anki/model";

export default function CaptureToAnki() {
  const [term, setTerm] = useState<string>();
  useEffect(() => {
    let active = true;
    getSelectedText()
      .then((value) => {
        if (active) setTerm(value.trim());
      })
      .catch(() => {
        if (!active) return;
        setTerm("");
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
  return term === undefined ? null : <CaptureForm initial={emptyDraft(term)} />;
}
