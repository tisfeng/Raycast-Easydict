/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { randomUUID } from "node:crypto";

import { Action, ActionPanel, Alert, Color, confirmAlert, Icon, List, showToast, Toast } from "@raycast/api";

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
import { getProviderIcon } from "@/components/ui/Icons";
import { myPreferences } from "@/consts";
import type { useAIProviderProfiles } from "@/hooks/useAIProviderProfiles";
import { ProviderConfig } from "@/providers/shared/config";

import { AIProviderForm } from "./AIProviderForm";

type ProfilesController = ReturnType<typeof useAIProviderProfiles>;

export default function AIProviderManagementPage({ controller }: { controller: ProfilesController }) {
  const profiles = controller.profiles ?? [];
  const legacyConfiguration = getLegacyAIProviderConfiguration();
  const hasLegacySettingsToImport = controller.storedState
    ? hasLegacyAIProvidersToImport(controller.storedState, legacyConfiguration)
    : false;
  const canImportLegacy = !controller.storedState?.migration?.legacyPreferencesImported && hasLegacySettingsToImport;
  const canReimportLegacy =
    controller.storedState?.migration?.legacyPreferencesImported === true && hasLegacySettingsToImport;

  async function saveProfiles(nextProfiles: AIProviderProfile[]) {
    const storedState = controller.storedState;
    if (!storedState) return;
    const normalizedProfiles = nextProfiles.map((profile, order) => ({ ...profile, order }));
    await controller.update({
      ...storedState,
      profiles: normalizedProfiles,
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
        await controller.update(importLegacyAIProviders(controller.storedState, legacyConfiguration));
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
        await controller.update(importLegacyAIProviders(controller.storedState, legacyConfiguration));
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

  return (
    <List isLoading={controller.isLoading} searchBarPlaceholder="Search AI providers...">
      {profiles.map((profile, index) => {
        const runnable = isAIProviderProfileRunnable(profile);
        const statusTag = getStatusTag(profile, runnable);
        return (
          <List.Item
            key={profile.id}
            icon={getProviderIcon(profile.icon, profile.name)}
            title={profile.name}
            subtitle={`${profile.adapter === "raycast-ai" ? "Raycast AI" : "OpenAI-Compatible"} · ${profile.model}`}
            accessories={[{ tag: statusTag }]}
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
                {index > 0 && (
                  <Action
                    title="Move up"
                    icon={Icon.ArrowUp}
                    onAction={() => saveProfiles(moveProfile(profiles, index, index - 1))}
                  />
                )}
                {index < profiles.length - 1 && (
                  <Action
                    title="Move Down"
                    icon={Icon.ArrowDown}
                    onAction={() => saveProfiles(moveProfile(profiles, index, index + 1))}
                  />
                )}
                <Action
                  title="Delete Provider"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={async () => {
                    const confirmed = await confirmAlert({
                      title: `Delete ${profile.name}?`,
                      message: "This removes the saved profile and its API key.",
                      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
                    });
                    if (confirmed) await saveProfiles(profiles.filter((candidate) => candidate.id !== profile.id));
                  }}
                />
                <ActionPanel.Section title="Add Provider">
                  {addAction(
                    "Add OpenAI-Compatible Provider",
                    createOpenAIProfile("custom", profiles.length),
                    Icon.Plus,
                    true,
                  )}
                  {addAction("Add Raycast AI Provider", createRaycastAIProfile(profiles.length), Icon.RaycastLogoNeg)}
                </ActionPanel.Section>
                {(legacyImportAction || legacyReimportAction) && (
                  <ActionPanel.Section title="Legacy Settings">
                    {legacyImportAction}
                    {legacyReimportAction}
                  </ActionPanel.Section>
                )}
              </ActionPanel>
            }
          />
        );
      })}
      <List.EmptyView
        icon={Icon.Stars}
        title="No Dynamic AI Providers"
        description="Add a Raycast AI or OpenAI-compatible provider."
        actions={
          <ActionPanel>
            {legacyImportAction}
            {addAction("Add Raycast AI Provider", createRaycastAIProfile(0), Icon.RaycastLogoNeg)}
            {addAction("Add OpenAI-Compatible Provider", createOpenAIProfile("custom", 0), Icon.Plus, true)}
            {legacyReimportAction && (
              <ActionPanel.Section title="Legacy Settings">{legacyReimportAction}</ActionPanel.Section>
            )}
          </ActionPanel>
        }
      />
    </List>
  );
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

function getStatusTag(profile: AIProviderProfile, runnable: boolean) {
  if (!runnable) return { value: "Invalid", color: Color.Red };
  return profile.enabled ? { value: "Enabled", color: Color.Green } : "Disabled";
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

function moveProfile(profiles: AIProviderProfile[], from: number, to: number): AIProviderProfile[] {
  const next = [...profiles];
  const [profile] = next.splice(from, 1);
  next.splice(to, 0, profile);
  return next;
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
