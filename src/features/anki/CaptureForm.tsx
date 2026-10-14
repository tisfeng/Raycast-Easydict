import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";

import { AnkiClient } from "./client";
import { type AnkiSettings, type CaptureDraft, emptyDraft, slots, switchDraftProfile } from "./model";
import { type ExistingNote, saveCapture, type SaveChoice } from "./service";
import AnkiSettingsPage from "./Settings";
import { clearDraft, draftKey, loadDraft, loadSettings, saveDraft } from "./storage";

export default function CaptureForm({
  initial = emptyDraft(),
  direction = "",
}: {
  initial?: CaptureDraft;
  direction?: string;
}) {
  const [key] = useState(() => draftKey(initial.term, direction));
  const [settings, setSettings] = useState<AnkiSettings>();
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(initial);
  const [fields, setFields] = useState<string[]>();
  const [error, setError] = useState("");
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [duplicates, setDuplicates] = useState<ExistingNote[]>();
  const [selectedNote, setSelectedNote] = useState("");
  const [savedId, setSavedId] = useState<number>();
  const [refresh, setRefresh] = useState(0);
  const profile = settings?.profiles.find((p) => p.id === draft.profileId);

  useEffect(() => {
    let active = true;
    Promise.all([loadSettings(), loadDraft(key)])
      .then(([config, restored]) => {
        if (!active) return;
        const matched = config.profiles.find((p) => `${p.fromLanguage}:${p.toLanguage}` === direction);
        const next = restored ?? { ...initial, profileId: matched?.id ?? config.activeProfileId };
        setSettings(config);
        setRestoredDraft(!!restored);
        setDraft(next);
        draftRef.current = next;
        setReady(true);
        setLoading(false);
      })
      .catch((cause) => {
        if (active) {
          setError(String(cause));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    let active = true;
    setFields(undefined);
    if (!ready) return;
    if (!settings || !profile?.model) {
      setLoading(false);
      setError("Choose a deck, note type, and field mapping in Anki Settings, then Reload Settings.");
      return;
    }
    setLoading(true);
    setError("");
    new AnkiClient(settings)
      .fields(profile.model)
      .then((value) => {
        if (active) setFields(value);
      })
      .catch((cause) => {
        if (active) setError(String(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [settings, profile?.id, profile?.model, ready, refresh]);

  function change(patch: Partial<CaptureDraft>) {
    if (!ready || busy.current) return;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDuplicates(undefined);
    setSelectedNote("");
    void saveDraft(key, next).catch((cause) => showFailureToast(cause, { title: "Could Not Save Draft" }));
  }
  async function submit(choice: SaveChoice = { kind: "add" }) {
    if (busy.current || !ready || savedId) return;
    busy.current = true;
    setSaving(true);
    try {
      await saveDraft(key, draftRef.current);
      if (!settings || !profile || !fields) throw new Error(error || "Configure Anki and reload settings first.");
      const result = await saveCapture(new AnkiClient(settings), profile, draftRef.current, choice);
      if (result.kind === "duplicates") {
        setDuplicates(result.notes);
        setSelectedNote("");
        await showToast({
          style: Toast.Style.Failure,
          title: "Word Already Exists",
          message: "Select a note to append context, or add a new sense.",
        });
      } else {
        // Mark successful before clearing local state: a storage failure must never encourage a second write.
        setSavedId(result.noteId);
        setDuplicates(undefined);
        await clearDraft(key);
        await showToast({
          style: Toast.Style.Success,
          title: result.kind === "added" ? "Added to Anki" : "Context Appended",
          message: `Note ${result.noteId}`,
        });
      }
    } catch (cause) {
      await showFailureToast(cause, { title: "Anki Capture" });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const selected = duplicates?.find((note) => String(note.noteId) === selectedNote);
  return (
    <Form
      isLoading={loading || saving}
      actions={
        <ActionPanel>
          {!savedId && <Action.SubmitForm title="Add to Anki" icon={Icon.Plus} onSubmit={() => submit()} />}
          {duplicates && (
            <>
              <Action
                title="Append Context to Selected Note"
                icon={Icon.Plus}
                onAction={() => {
                  if (!selectedNote) {
                    void showToast({ style: Toast.Style.Failure, title: "Select an Existing Note First" });
                    return;
                  }
                  void submit({ kind: "append", noteId: Number(selectedNote) });
                }}
              />
              <Action title="Add as New Sense" icon={Icon.Plus} onAction={() => submit({ kind: "new-sense" })} />
              <Action
                title="Cancel Duplicate Action"
                icon={Icon.XMarkCircle}
                onAction={() => {
                  setDuplicates(undefined);
                  setSelectedNote("");
                }}
              />
            </>
          )}
          {savedId && (
            <Action
              title="New Capture"
              icon={Icon.Plus}
              onAction={() => {
                setSavedId(undefined);
                setRestoredDraft(false);
                change({ ...emptyDraft(), profileId: draft.profileId });
              }}
            />
          )}
          <Action.Push title="Anki Settings" icon={Icon.Gear} target={<AnkiSettingsPage />} />
          <Action
            title="Reload Settings"
            icon={Icon.ArrowClockwise}
            onAction={async () => {
              if (busy.current) return;
              try {
                setSettings(await loadSettings());
                setRefresh((value) => value + 1);
                setDuplicates(undefined);
              } catch (cause) {
                await showFailureToast(cause, { title: "Could Not Load Settings" });
              }
            }}
          />
        </ActionPanel>
      }
    >
      {savedId ? (
        <Form.Description
          title="Saved to Anki"
          text={`Note ${savedId}. Go back to look up another word, or use New Capture.`}
        />
      ) : (
        <>
          {restoredDraft && (
            <Form.Description text="Restored your unsent draft for this word. Edit it before adding." />
          )}
          {error && <Form.Description title="Connection / Setup" text={error} />}
          {!ready && !loading && (
            <Form.Description text="The original draft or settings could not be read. Nothing will be overwritten." />
          )}
          <Form.Dropdown
            id="profile"
            title="Profile"
            value={draft.profileId}
            onChange={(id) => {
              if (id !== draft.profileId) change(switchDraftProfile(draftRef.current, id));
            }}
          >
            {(settings?.profiles ?? []).map((p) => (
              <Form.Dropdown.Item key={p.id} value={p.id} title={p.name} />
            ))}
          </Form.Dropdown>
          {profile && (
            <Form.Description
              text={`${profile.deck || "No deck"} · ${profile.model || "No note type"} · Tags: ${profile.tags.join(" ")}`}
            />
          )}
          <Form.TextField
            id="term"
            title={`Term${profile?.mapping.term ? ` → ${profile.mapping.term}` : ""}`}
            value={draft.term}
            onChange={(term) => change({ term })}
          />
          <Form.TextArea
            id="meaning"
            title={`Meaning${profile?.mapping.meaning ? ` → ${profile.mapping.meaning}` : " (not mapped)"}`}
            value={draft.meaning}
            onChange={(meaning) => change({ meaning })}
          />
          <Form.TextArea
            id="example"
            title={`Example${profile?.mapping.example ? ` → ${profile.mapping.example}` : " (not mapped)"}`}
            value={draft.example}
            onChange={(example) => change({ example })}
          />
          <Form.TextArea
            id="context"
            title={`Context${profile?.mapping.context ? ` → ${profile.mapping.context}` : " (not mapped)"}`}
            value={draft.context}
            onChange={(context) => change({ context })}
            placeholder="Paste the original sentence or your notes"
          />
          <Form.TextField
            id="source"
            title="Source (Optional)"
            value={draft.source}
            onChange={(source) => change({ source })}
            placeholder="Page title, URL, book, or lesson"
          />
          <Form.FilePicker
            id="images"
            title="Context Images"
            value={draft.images}
            onChange={(images) => change({ images })}
            allowMultipleSelection
            canChooseDirectories={false}
            canChooseFiles
            info="PNG, JPEG, GIF, WebP; up to 10 images, 10 MB each."
          />
          {fields
            ?.filter((field) => !slots.some((slot) => profile?.mapping[slot] === field))
            .map((field) => (
              <Form.TextArea
                key={field}
                id={`extra:${field}`}
                title={field}
                value={draft.extra[field] ?? ""}
                onChange={(value) => change({ extra: { ...draftRef.current.extra, [field]: value } })}
              />
            ))}
          {duplicates && (
            <>
              <Form.Separator />
              <Form.Description
                title="Duplicate Found"
                text="Choose a note and use Append Context, or use Add as New Sense. Appending changes only Context; meaning and example edits are not applied."
              />
              <Form.Dropdown id="existing" title="Existing Note" value={selectedNote} onChange={setSelectedNote}>
                <Form.Dropdown.Item value="" title="Select a note" />
                {duplicates.map((note) => (
                  <Form.Dropdown.Item
                    key={note.noteId}
                    value={String(note.noteId)}
                    title={`#${note.noteId} · ${note.fields[profile?.mapping.meaning ?? ""]?.value.slice(0, 100) || note.modelName}`}
                  />
                ))}
              </Form.Dropdown>
              {selected && (
                <Form.Description
                  title="Existing Context (HTML)"
                  text={selected.fields[profile?.mapping.context ?? ""]?.value || "Empty"}
                />
              )}
            </>
          )}
        </>
      )}
    </Form>
  );
}
