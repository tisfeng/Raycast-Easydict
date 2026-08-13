/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { randomUUID } from "node:crypto";

import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  type Keyboard,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";

import {
  hasLegacyAIProvidersToImport,
  importLegacyAIProviders,
  type LegacyAIProviderConfiguration,
} from "@/ai-providers/legacy";
import { getDefaultRaycastAIModel } from "@/ai-providers/modelCatalog";
import { OPENAI_COMPATIBLE_PRESETS, type OpenAICompatiblePresetName } from "@/ai-providers/presets";
import { createEmptyAIProviderState } from "@/ai-providers/repository";
import { isAIProviderProfileRunnable } from "@/ai-providers/runtime";
import type { AIProviderProfile, OpenAICompatibleProfile, RaycastAIProfile } from "@/ai-providers/types";
import { getProviderIcon, getQueryTypeIcon } from "@/components/ui/Icons";
import { myPreferences } from "@/consts";
import {
  getAIProviderKey,
  getAvailableProviderKeys,
  getProviderOrder,
  reconcileProviderOrder,
  syncAIProviderOrders,
} from "@/core/query/providerOrder";
import type { useAIProviderProfiles } from "@/hooks/useAIProviderProfiles";
import { dictionaryProviderServices } from "@/providers/dictionary";
import { ProviderConfig } from "@/providers/shared/config";
import { translationServices } from "@/providers/translation";

import { AIProviderForm } from "./AIProviderForm";

type ProfilesController = ReturnType<typeof useAIProviderProfiles>;

type BuiltinService = (typeof dictionaryProviderServices)[number] | (typeof translationServices)[number];

type ProviderRow = { kind: "builtin"; service: BuiltinService } | { kind: "ai"; profile: AIProviderProfile };

const MOVE_UP_SHORTCUT = {
  macOS: { modifiers: ["cmd", "shift"], key: "arrowUp" },
  Windows: { modifiers: ["ctrl", "shift"], key: "arrowUp" },
} satisfies Keyboard.Shortcut;

const MOVE_DOWN_SHORTCUT = {
  macOS: { modifiers: ["cmd", "shift"], key: "arrowDown" },
  Windows: { modifiers: ["ctrl", "shift"], key: "arrowDown" },
} satisfies Keyboard.Shortcut;

export default function AIProviderManagementPage({ controller }: { controller: ProfilesController }) {
  const profiles = controller.profiles ?? [];
  const legacyConfiguration = getLegacyAIProviderConfiguration();
  const hasLegacySettingsToImport = controller.storedState
    ? hasLegacyAIProvidersToImport(controller.storedState, legacyConfiguration)
    : false;
  const canImportLegacy = !controller.storedState?.migration?.legacyPreferencesImported && hasLegacySettingsToImport;
  const canReimportLegacy =
    controller.storedState?.migration?.legacyPreferencesImported === true && hasLegacySettingsToImport;

  const servicesOrder = myPreferences.servicesOrder ? myPreferences.servicesOrder.split(",") : [];
  const providerOrder = getProviderOrder(profiles, controller.storedState?.providerOrder, servicesOrder);
  const importedProviderKeys = new Set(profiles.map(getAIProviderKey));
  const builtinServices = [
    ...(dictionaryProviderServices as BuiltinService[]),
    ...(translationServices as BuiltinService[]),
  ]
    .filter((service) => !importedProviderKeys.has(service.providerKey))
    .map((service) => ({ kind: "builtin" as const, service }));
  const rows: ProviderRow[] = [
    ...builtinServices,
    ...profiles.map((profile) => ({ kind: "ai" as const, profile })),
  ].sort((left, right) => {
    const leftKey = left.kind === "builtin" ? left.service.providerKey : getAIProviderKey(left.profile);
    const rightKey = right.kind === "builtin" ? right.service.providerKey : getAIProviderKey(right.profile);
    return providerOrder.indexOf(leftKey) - providerOrder.indexOf(rightKey);
  });
  async function saveProfiles(nextProfiles: AIProviderProfile[], requestedProviderOrder?: string[]) {
    const storedState = controller.storedState;
    if (!storedState) return;
    const savedOrder = requestedProviderOrder ?? storedState.providerOrder;
    const fallbackOrder = getProviderOrder(nextProfiles, undefined, servicesOrder);
    const previousFallbackOrder = getProviderOrder(storedState.profiles, undefined, servicesOrder);
    const previousKeys = new Set(getAvailableProviderKeys(storedState.profiles));
    const appendNewKeys = fallbackOrder.filter((key) => !previousKeys.has(key));
    const nextProviderOrder = reconcileProviderOrder(
      savedOrder,
      getAvailableProviderKeys(nextProfiles),
      savedOrder ? fallbackOrder : [...previousFallbackOrder, ...appendNewKeys],
    );
    const normalizedProfiles = syncAIProviderOrders(nextProfiles, nextProviderOrder);
    await controller.update({
      ...storedState,
      profiles: normalizedProfiles,
      providerOrder: nextProviderOrder,
    });
    if (normalizedProfiles.filter((profile) => profile.adapter === "raycast-ai" && profile.enabled).length > 1) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Multiple Raycast AI providers enabled",
        message: "Extension AI requests are rate-limited; rapid queries may fail.",
      });
    }
  }

  function addAction(title: string, profile: AIProviderProfile, icon = Icon.Plus, showPresetSelector = false) {
    return (
      <Action.Push
        title={title}
        icon={icon}
        target={
          <AIProviderForm
            profile={profile}
            showPresetSelector={showPresetSelector}
            onSave={(saved) => saveProfiles([...profiles, saved])}
          />
        }
      />
    );
  }

  const legacyImportAction = canImportLegacy ? (
    <Action
      title="✨ Import Legacy AI Settings"
      icon={Icon.Download}
      onAction={async () => {
        if (!controller.storedState) return;
        const imported = importLegacyAIProviders(controller.storedState, legacyConfiguration);
        await saveProfiles(imported.profiles, imported.providerOrder);
        await showToast({ style: Toast.Style.Success, title: "Legacy AI providers imported" });
      }}
    />
  ) : null;
  const legacyReimportAction = canReimportLegacy ? (
    <Action
      title="Re-Import Legacy AI Settings"
      icon={Icon.Download}
      onAction={async () => {
        if (!controller.storedState) return;
        const imported = importLegacyAIProviders(controller.storedState, legacyConfiguration);
        await saveProfiles(imported.profiles, imported.providerOrder);
        await showToast({ style: Toast.Style.Success, title: "Missing legacy AI providers restored" });
      }}
    />
  ) : null;

  if (!controller.storedState && !controller.isLoading) {
    const message = getConfigurationErrorMessage(controller);
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="AI Provider Configuration Error"
          description={message}
          actions={
            <ActionPanel>
              <Action
                title="Reset AI Provider Configuration"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={async () => {
                  const confirmed = await confirmAlert({
                    title: "Reset AI provider configuration?",
                    message: "This permanently removes all saved dynamic providers and API keys.",
                    primaryAction: { title: "Reset", style: Alert.ActionStyle.Destructive },
                  });
                  if (confirmed) await controller.update(createEmptyAIProviderState());
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  async function moveProvider(providerKey: string, offset: -1 | 1) {
    const currentIndex = providerOrder.indexOf(providerKey);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= providerOrder.length) return;
    const nextOrder = [...providerOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    await saveProfiles(profiles, nextOrder);
  }

  function moveActions(providerKey: string) {
    const index = providerOrder.indexOf(providerKey);
    return (
      <>
        {index > 0 && (
          <Action
            title="Move up"
            icon={Icon.ArrowUp}
            shortcut={MOVE_UP_SHORTCUT}
            onAction={() => moveProvider(providerKey, -1)}
          />
        )}
        {index < providerOrder.length - 1 && (
          <Action
            title="Move Down"
            icon={Icon.ArrowDown}
            shortcut={MOVE_DOWN_SHORTCUT}
            onAction={() => moveProvider(providerKey, 1)}
          />
        )}
      </>
    );
  }

  function legacySettingsSection() {
    if (!legacyImportAction && !legacyReimportAction) return null;
    return (
      <ActionPanel.Section title="Legacy Settings">
        {legacyImportAction}
        {legacyReimportAction}
      </ActionPanel.Section>
    );
  }

  function addProviderSection() {
    return (
      <ActionPanel.Section title="Add Provider">
        {addAction("Add OpenAI-Compatible Provider", createOpenAIProfile("custom", profiles.length), Icon.Plus, true)}
        {addAction("Add Raycast AI Provider", createRaycastAIProfile(profiles.length), Icon.RaycastLogoNeg)}
      </ActionPanel.Section>
    );
  }

  return (
    <List isLoading={controller.isLoading} searchBarPlaceholder="Search providers...">
      {profiles.length === 0 && (
        <List.Item
          key="provider-actions"
          id="provider-actions"
          icon={Icon.Plus}
          title={legacyImportAction || legacyReimportAction ? "Add or Import Providers" : "Add Providers"}
          subtitle="Create an AI provider or restore legacy settings"
          actions={
            <ActionPanel>
              {addProviderSection()}
              {legacySettingsSection()}
            </ActionPanel>
          }
        />
      )}
      {rows.map((row) => {
        if (row.kind === "builtin") {
          const { service } = row;
          return (
            <List.Item
              key={service.providerKey}
              id={service.providerKey}
              icon={getQueryTypeIcon(service.type)}
              title={service.label}
              accessories={[{ tag: "Built-in" }, { tag: getBuiltinPreferenceStatusTag(service.enabledInPreferences) }]}
              actions={
                <ActionPanel>
                  <Action title="Open Extension Settings" icon={Icon.Gear} onAction={openExtensionPreferences} />
                  {moveActions(service.providerKey)}
                </ActionPanel>
              }
            />
          );
        }

        const { profile } = row;
        const runnable = isAIProviderProfileRunnable(profile);
        const providerKey = getAIProviderKey(profile);
        return (
          <List.Item
            key={providerKey}
            id={providerKey}
            icon={getProviderIcon(profile.icon, profile.name)}
            title={profile.name}
            subtitle={`${profile.adapter === "raycast-ai" ? "Raycast AI" : "OpenAI-Compatible"} · ${profile.model}`}
            accessories={getAIProviderAccessories(profile, runnable)}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Edit Provider"
                  icon={Icon.Pencil}
                  target={
                    <AIProviderForm
                      profile={profile}
                      onSave={(saved) =>
                        saveProfiles(profiles.map((candidate) => (candidate.id === saved.id ? saved : candidate)))
                      }
                    />
                  }
                />
                <Action
                  title={profile.enabled ? "Disable Provider" : "Enable Provider"}
                  icon={profile.enabled ? Icon.Pause : Icon.Play}
                  onAction={() =>
                    saveProfiles(
                      profiles.map((candidate) =>
                        candidate.id === profile.id ? { ...candidate, enabled: !candidate.enabled } : candidate,
                      ),
                    )
                  }
                />
                <Action
                  title="Duplicate Provider"
                  icon={Icon.Duplicate}
                  onAction={() =>
                    saveProfiles([
                      ...profiles,
                      { ...profile, id: randomUUID(), name: `${profile.name} Copy`, enabled: false },
                    ])
                  }
                />
                {moveActions(providerKey)}
                <Action
                  title="Delete Provider"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={async () => {
                    const confirmed = await confirmAlert({
                      title: `Delete ${profile.name}?`,
                      message: "This removes the saved provider and its API key.",
                      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
                    });
                    if (confirmed) await saveProfiles(profiles.filter((candidate) => candidate.id !== profile.id));
                  }}
                />
                {addProviderSection()}
                {legacySettingsSection()}
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function getAIProviderStatusTag(profile: AIProviderProfile, runnable: boolean) {
  if (!runnable) return { value: "Invalid", color: Color.Red };
  return profile.enabled ? { value: "Enabled", color: Color.Green } : { value: "Disabled", color: Color.SecondaryText };
}

function getAIProviderAccessories(profile: AIProviderProfile, runnable: boolean) {
  return [{ tag: "AI Provider" }, { tag: getAIProviderStatusTag(profile, runnable) }];
}

function getBuiltinPreferenceStatusTag(enabled: boolean | undefined) {
  return enabled ? { value: "Enabled", color: Color.Green } : { value: "Disabled", color: Color.SecondaryText };
}

function getConfigurationErrorMessage(controller: ProfilesController): string {
  switch (controller.state.kind) {
    case "invalid":
      return controller.state.message;
    case "unsupported":
      return `Unsupported configuration version: ${String(controller.state.version)}`;
    case "error":
      return controller.state.error.message;
    default:
      return "The provider configuration could not be loaded.";
  }
}

function createOpenAIProfile(presetName: OpenAICompatiblePresetName, order: number): OpenAICompatibleProfile {
  const preset = OPENAI_COMPATIBLE_PRESETS[presetName];
  return {
    id: randomUUID(),
    adapter: "openai-compatible",
    enabled: true,
    order,
    apiKey: "",
    wordResultMode: "translation",
    jsonOutputMode: "prompt",
    ...preset,
  };
}

function createRaycastAIProfile(order: number): RaycastAIProfile {
  return {
    id: randomUUID(),
    adapter: "raycast-ai",
    name: "Raycast AI",
    enabled: false,
    order,
    model: getDefaultRaycastAIModel(),
    icon: { kind: "preset", name: "raycast" },
    wordResultMode: "translation",
  };
}

function getLegacyAIProviderConfiguration(): LegacyAIProviderConfiguration {
  return {
    openAI: {
      configured: Boolean(ProviderConfig.openAIAPIKey),
      enabled: myPreferences.enableOpenAITranslate,
      endpoint: ProviderConfig.openAIEndpoint,
      model: ProviderConfig.openAIModel,
      apiKey: ProviderConfig.openAIAPIKey ?? "",
      forceMaxCompletionTokens: ProviderConfig.forceMaxCompletionTokens,
    },
    gemini: {
      configured: Boolean(ProviderConfig.geminiAPIKey),
      enabled: myPreferences.enableGeminiTranslate,
      endpoint: ProviderConfig.geminiEndpoint,
      model: ProviderConfig.geminiModel,
      apiKey: ProviderConfig.geminiAPIKey ?? "",
    },
  };
}
