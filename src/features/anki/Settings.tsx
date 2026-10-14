import { randomUUID } from "node:crypto";

import { Action, ActionPanel, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { useRef, useState } from "react";

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
    const connection = client();
    const result = await connection.catalog();
    const nextFields =
      profile.model && result.models.includes(profile.model) ? await connection.fields(profile.model) : undefined;
    if (token !== generation.current) return;
    setCatalog(result);
    setFields(nextFields);
    await showToast({ style: Toast.Style.Success, title: "Connected to Anki" });
  }
  async function selectModel(model: string) {
    const token = ++generation.current;
    update({ model });
    setFields(undefined);
    try {
      const result = await client().fields(model);
      if (token === generation.current) setFields(result);
    } catch (error) {
      if (token === generation.current) await showFailureToast(error, { title: "Could Not Read Fields" });
    }
  }
  function invalidateConnection() {
    generation.current++;
    setCatalog(undefined);
    setFields(undefined);
  }
  return (
    <Form
      isLoading={loading}
      navigationTitle="Anki Profile"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Profile"
            onSubmit={() =>
              operation(async () => {
                if (!catalog || !fields) throw new Error("Connect to Anki and select a note type first.");
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
          <Action title="Connect / Refresh Anki" icon={Icon.ArrowClockwise} onAction={() => operation(connect)} />
          <Action
            title="Create Four-Field Note Type"
            icon={Icon.Plus}
            onAction={() =>
              operation(async () => {
                const token = ++generation.current;
                const connection = client();
                const model = await connection.createTemplate();
                const nextCatalog = await connection.catalog();
                const nextFields = await connection.fields(model);
                if (token !== generation.current) return;
                setCatalog(nextCatalog);
                setFields(nextFields);
                update({ model, mapping: defaultProfile().mapping });
                await showToast({ style: Toast.Style.Success, title: "Created Easydict Capture" });
              })
            }
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Connect / Refresh Anki (Actions) loads your decks and note types. Connection settings apply to all capture profiles. Legacy Favorites export still uses Extension Preferences." />
      <Form.TextField
        id="url"
        title="AnkiConnect URL"
        value={url}
        onChange={(value) => {
          setUrl(value);
          invalidateConnection();
        }}
      />
      <Form.PasswordField
        id="apiKey"
        title="API Key (Optional)"
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
          if (value && value !== profile.model) void selectModel(value);
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
