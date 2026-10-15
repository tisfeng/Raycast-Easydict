import { randomUUID } from "node:crypto";

import { Action, ActionPanel, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";

import { AnkiClient, endpoint } from "./client";
import { type AnkiProfile, type AnkiSettings, defaultProfile, slots, validateProfile } from "./model";
import { loadSettings, saveSettings } from "./storage";

export default function AnkiSettingsPage() {
  const { data, isLoading, revalidate } = usePromise(loadSettings, []);
  return (
    <List isLoading={isLoading}>
      {data?.profiles.map((profile) => (
        <List.Item
          key={profile.id}
          title={profile.name}
          subtitle={profile.model ? `${profile.deck} · ${profile.model}` : "Choose a deck and note type"}
          accessories={profile.id === data.activeProfileId ? [{ text: "Default" }] : []}
          actions={
            <ActionPanel>
              <Action.Push
                title="Edit Profile"
                icon={Icon.Pencil}
                target={<ProfileForm settings={data} initial={profile} onSaved={revalidate} />}
              />
              <Action.Push
                title="Add Profile"
                icon={Icon.Plus}
                target={
                  <ProfileForm
                    settings={data}
                    initial={{ ...defaultProfile(), id: randomUUID(), name: "New Profile" }}
                    onSaved={revalidate}
                  />
                }
              />
              <Action
                title="Use as Default"
                icon={Icon.Checkmark}
                onAction={async () => {
                  try {
                    const latest = await loadSettings();
                    await saveSettings({ ...latest, activeProfileId: profile.id });
                    await revalidate();
                  } catch (error) {
                    await showFailureToast(error, { title: "Could Not Save Settings" });
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView
        title="Anki settings unavailable"
        description="If loading failed, original settings are preserved. Reopen this command to retry."
      />
    </List>
  );
}
function ProfileForm({
  settings,
  initial,
  onSaved,
}: {
  settings: AnkiSettings;
  initial: AnkiProfile;
  onSaved: () => Promise<unknown>;
}) {
  const { pop } = useNavigation();
  const [profile, setProfile] = useState(initial);
  const [url, setUrl] = useState(settings.url);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [tags, setTags] = useState(initial.tags.join(" "));
  const [catalog, setCatalog] = useState<{ decks: string[]; models: string[] }>();
  const [fields, setFields] = useState<string[]>();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [connectionError, setConnectionError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [fieldLoading, setFieldLoading] = useState(false);
  const [connectedClient, setConnectedClient] = useState<AnkiClient>();
  const busy = useRef(false);
  const generation = useRef(0);
  const client = () => new AnkiClient({ url, apiKey });
  const update = (patch: Partial<AnkiProfile>) => setProfile((p) => ({ ...p, ...patch }));
  async function operation(fn: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      await showFailureToast(error, { title: "Anki Settings" });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  async function connect() {
    const token = ++generation.current;
    setStatus("connecting");
    setConnectionError("");
    setCatalog(undefined);
    setFields(undefined);
    setFieldError("");
    const connection = client();
    try {
      const result = await connection.catalog();
      if (token !== generation.current) return;
      setCatalog(result);
      setConnectedClient(connection);
      setStatus("connected");
    } catch (error) {
      if (token !== generation.current) return;
      setStatus("error");
      setConnectionError(error instanceof Error ? error.message : "Connection failed.");
    }
  }
  useEffect(() => {
    void connect();
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setFields(undefined);
    setFieldError("");
    if (!catalog || !connectedClient || !profile.model || !catalog.models.includes(profile.model)) {
      setFieldLoading(false);
      return;
    }
    setFieldLoading(true);
    connectedClient
      .fields(profile.model)
      .then((value) => {
        if (active) setFields(value);
      })
      .catch((error) => {
        if (active) setFieldError(error instanceof Error ? error.message : "Could not read fields.");
      })
      .finally(() => {
        if (active) setFieldLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalog, connectedClient, profile.model]);
  function invalidateConnection() {
    generation.current++;
    setStatus("idle");
    setCatalog(undefined);
    setFields(undefined);
    setFieldError("");
    setConnectionError("");
  }
  const missing = catalog
    ? [
        profile.deck && !catalog.decks.includes(profile.deck)
          ? `Selected deck "${profile.deck}" no longer exists. Choose a deck.`
          : "",
        profile.model && !catalog.models.includes(profile.model)
          ? `Selected note type "${profile.model}" no longer exists. Choose a note type.`
          : "",
        fields &&
        (slots.some((slot) => profile.mapping[slot] && !fields.includes(profile.mapping[slot])) ||
          (!!profile.idField && !fields.includes(profile.idField)))
          ? "Mapped fields no longer exist. Update the field mapping."
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const connectionAction = <Action title="Test Connection / Retry" icon={Icon.ArrowClockwise} onAction={connect} />;
  return (
    <Form
      isLoading={loading || status === "connecting" || fieldLoading}
      navigationTitle="Anki Profile"
      actions={
        <ActionPanel>
          {(status !== "connected" || !!fieldError) && connectionAction}
          <Action.SubmitForm
            title="Save Profile"
            onSubmit={() =>
              operation(async () => {
                if (missing) throw new Error(missing);
                if (!catalog || !fields || status !== "connected")
                  throw new Error("Connect to Anki and select a note type first.");
                const next = { ...profile, name: profile.name.trim(), tags: tags.split(/\s+/).filter(Boolean) };
                validateProfile(next, fields);
                if (!catalog.decks.includes(next.deck) || !catalog.models.includes(next.model))
                  throw new Error("Choose an existing deck and note type.");
                const latest = await loadSettings();
                const profiles = latest.profiles.some((p) => p.id === next.id)
                  ? latest.profiles.map((p) => (p.id === next.id ? next : p))
                  : [...latest.profiles, next];
                await saveSettings({ ...latest, url: endpoint(url), apiKey, profiles });
                await onSaved();
                await showToast({ style: Toast.Style.Success, title: "Anki Profile Saved" });
                pop();
              })
            }
          />
          {status === "connected" && !fieldError && connectionAction}
          <Action
            title="Create Capture Note Type"
            icon={Icon.Plus}
            onAction={() =>
              operation(async () => {
                const token = ++generation.current;
                const connection = client();
                const model = await connection.createTemplate();
                const nextCatalog = await connection.catalog();
                if (token !== generation.current) return;
                setConnectedClient(connection);
                setStatus("connected");
                setCatalog(nextCatalog);
                update({ model, mapping: defaultProfile().mapping });
                await showToast({ style: Toast.Style.Success, title: "Created Easydict Capture" });
              })
            }
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Connection"
        text={
          status === "connected"
            ? `Connected · ${catalog?.decks.length ?? 0} decks · ${catalog?.models.length ?? 0} note types`
            : status === "connecting"
              ? "Connecting to Anki…"
              : status === "error"
                ? connectionError
                : "Connection settings changed. Leave the field to reconnect, or use Test Connection / Retry."
        }
      />
      {!!missing && <Form.Description title="Update Selection" text={missing} />}
      {!!fieldError && <Form.Description title="Could Not Read Fields" text={fieldError} />}
      <Form.TextField
        id="url"
        title="AnkiConnect URL"
        onBlur={() => {
          if (status === "idle") void connect();
        }}
        value={url}
        onChange={(value) => {
          setUrl(value);
          invalidateConnection();
        }}
      />
      <Form.PasswordField
        id="apiKey"
        title="API Key (Optional)"
        onBlur={() => {
          if (status === "idle") void connect();
        }}
        value={apiKey}
        onChange={(value) => {
          setApiKey(value);
          invalidateConnection();
        }}
      />
      <Form.Separator />
      <Form.TextField id="name" title="Profile Name" value={profile.name} onChange={(name) => update({ name })} />
      <Form.TextField
        id="from"
        title="Source Language"
        value={profile.fromLanguage}
        onChange={(fromLanguage) => update({ fromLanguage })}
        info="Language code, e.g. en, ja, fr."
      />
      <Form.TextField
        id="to"
        title="Meaning Language"
        value={profile.toLanguage}
        onChange={(toLanguage) => update({ toLanguage })}
        info="Language code, e.g. zh-CHS. Used to select a profile for lookup results."
      />
      <Form.Dropdown id="deck" title="Deck" value={profile.deck} onChange={(deck) => update({ deck })}>
        <Form.Dropdown.Item value="" title="Choose a deck" />
        {(catalog?.decks ?? (profile.deck ? [profile.deck] : [])).map((deck) => (
          <Form.Dropdown.Item key={deck} value={deck} title={deck} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown
        id="model"
        title="Note Type"
        value={profile.model}
        onChange={(value) => {
          if (value !== profile.model) update({ model: value });
        }}
      >
        <Form.Dropdown.Item value="" title="Choose a note type" />
        {(catalog?.models ?? (profile.model ? [profile.model] : [])).map((model) => (
          <Form.Dropdown.Item key={model} value={model} title={model} />
        ))}
      </Form.Dropdown>
      {slots.map((slot) => (
        <Form.Dropdown
          key={slot}
          id={slot}
          title={`${slot[0].toUpperCase()}${slot.slice(1)} → Field`}
          value={profile.mapping[slot]}
          onChange={(value) => update({ mapping: { ...profile.mapping, [slot]: value } })}
        >
          <Form.Dropdown.Item value="" title={slot === "term" ? "Choose a field (required)" : "Not mapped"} />
          {[...new Set([...(fields ?? []), ...(profile.mapping[slot] ? [profile.mapping[slot]] : [])])].map((field) => (
            <Form.Dropdown.Item key={field} value={field} title={field} />
          ))}
        </Form.Dropdown>
      ))}
      <Form.Dropdown
        id="idField"
        title="Automatic ID Field"
        value={profile.idField === undefined ? "auto" : profile.idField ? `field:${profile.idField}` : "off"}
        onChange={(value) => update({ idField: value === "auto" ? undefined : value === "off" ? "" : value.slice(6) })}
        info="Auto-detect uses a field named ID (case-insensitive). IDs are assigned on submission, e.g. en.bearing.03."
      >
        <Form.Dropdown.Item value="auto" title="Auto-detect ID" />
        <Form.Dropdown.Item value="off" title="Disabled" />
        {[...new Set([...(fields ?? []), ...(profile.idField ? [profile.idField] : [])])].map((field) => (
          <Form.Dropdown.Item key={field} value={`field:${field}`} title={field} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="tags"
        title="Default Tags"
        value={tags}
        onChange={setTags}
        info="Separate tags with spaces."
      />
    </Form>
  );
}
