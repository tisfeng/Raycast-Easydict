/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { randomUUID } from "node:crypto";

import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  hasLegacyAIProvidersToImport,
  importLegacyAIProviders,
  type LegacyAIProviderConfiguration,
} from "@/ai-providers/legacy";
import {
  type AIModelOption,
  getDefaultRaycastAIModel,
  resolveAIProviderModelCatalog,
} from "@/ai-providers/modelCatalog";
import { OPENAI_COMPATIBLE_PRESETS, type OpenAICompatiblePresetName } from "@/ai-providers/presets";
import { getAIProviderProfileValidationError, normalizeAIProviderProfile } from "@/ai-providers/profile";
import { createEmptyAIProviderState } from "@/ai-providers/repository";
import type {
  AIProviderProfile,
  OpenAICompatibleProfile,
  ProviderIconConfig,
  RaycastAIProfile,
  TokenLimitMode,
} from "@/ai-providers/types";
import { getProviderIcon } from "@/components/ui/Icons";
import { myPreferences } from "@/consts";
import type { useAIProviderProfiles } from "@/hooks/useAIProviderProfiles";
import { ProviderConfig } from "@/providers/shared/config";
import { createAITranslationProvider, isAIProviderProfileRunnable } from "@/providers/translation";
import { normalizeError } from "@/utils/errors";
import { logTrace, logWarn } from "@/utils/logger";

type ProfilesController = ReturnType<typeof useAIProviderProfiles>;
type IconSelection =
  | Exclude<ProviderIconConfig["kind"], "preset">
  | Extract<ProviderIconConfig, { kind: "preset" }>["name"];

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
        style: Toast.Style.Animated,
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
    const message =
      controller.state.kind === "invalid"
        ? controller.state.message
        : controller.state.kind === "unsupported"
          ? `Unsupported configuration version: ${String(controller.state.version)}`
          : controller.state.kind === "error"
            ? controller.state.error.message
            : "The provider configuration could not be loaded.";
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
        const statusTag = !runnable
          ? { value: "Invalid", color: Color.Red }
          : profile.enabled
            ? { value: "Enabled", color: Color.Green }
            : "Disabled";
        return (
          <List.Item
            key={profile.id}
            icon={getProviderIcon(profile.icon, profile.name)}
            title={profile.name}
            subtitle={`${profile.adapter === "raycast-ai" ? "Raycast AI" : "OpenAI-Compatible"} · ${profile.model}`}
            accessories={[{ tag: statusTag }]}
            actions={
              <ActionPanel>
                {legacyImportAction}
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
                {legacyReimportAction && (
                  <ActionPanel.Section title="Legacy Settings">{legacyReimportAction}</ActionPanel.Section>
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

function AIProviderForm({
  profile,
  onSave,
  showPresetSelector = false,
}: {
  profile: AIProviderProfile;
  onSave: (profile: AIProviderProfile) => Promise<void>;
  showPresetSelector?: boolean;
}) {
  const { pop } = useNavigation();
  const [name, setName] = useState(profile.name);
  const [model, setModel] = useState(profile.model);
  const [endpoint, setEndpoint] = useState(profile.adapter === "openai-compatible" ? profile.endpoint : "");
  const [website, setWebsite] = useState(profile.adapter === "openai-compatible" ? (profile.website ?? "") : "");
  const [apiKey, setAPIKey] = useState(profile.adapter === "openai-compatible" ? profile.apiKey : "");
  const [tokenLimitMode, setTokenLimitMode] = useState<TokenLimitMode>(
    profile.adapter === "openai-compatible" ? profile.tokenLimitMode : "max-tokens",
  );
  const [iconSelection, setIconSelection] = useState<IconSelection>(
    profile.icon.kind === "preset" ? profile.icon.name : profile.icon.kind,
  );
  const [iconURL, setIconURL] = useState(profile.icon.kind === "remote" ? profile.icon.url : "");
  const [presetName, setPresetName] = useState<OpenAICompatiblePresetName>("custom");
  const [modelSearchText, setModelSearchText] = useState("");
  const modelCatalog = useMemo(
    () =>
      resolveAIProviderModelCatalog(
        profile.adapter === "openai-compatible" ? { ...profile, endpoint, apiKey } : profile,
      ),
    [apiKey, endpoint, profile],
  );
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>(() => modelCatalog.getCachedOptions());
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const testAbortController = useRef<AbortController | null>(null);
  const modelAbortController = useRef<AbortController | null>(null);
  const loadedModelsKey = useRef<string | null>(null);
  const loadingModelsKey = useRef<string | null>(null);

  function selectPreset(nextPresetName: OpenAICompatiblePresetName) {
    const preset = OPENAI_COMPATIBLE_PRESETS[nextPresetName];
    setPresetName(nextPresetName);
    setName(preset.name);
    setEndpoint(preset.endpoint);
    setWebsite("website" in preset ? preset.website : "");
    setModel(preset.model);
    setTokenLimitMode(preset.tokenLimitMode);
    setIconSelection(preset.icon.kind === "preset" ? preset.icon.name : preset.icon.kind);
  }

  function buildDraftProfile(): AIProviderProfile {
    const icon = getIconConfig(iconSelection, iconURL, website);

    return normalizeAIProviderProfile(
      profile.adapter === "raycast-ai"
        ? { ...profile, name, model, icon }
        : {
            ...profile,
            name,
            endpoint,
            website,
            model,
            apiKey,
            tokenLimitMode,
            icon,
          },
    );
  }

  async function submit() {
    const saved = buildDraftProfile();
    if (!isAIProviderProfileRunnable(saved)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Provider configuration is incomplete",
        message: getAIProviderProfileValidationError(saved) ?? "Choose an available Raycast AI model.",
      });
      return;
    }

    await onSave(saved);
    pop();
  }

  async function testProvider() {
    const draft = buildDraftProfile();
    if (!isAIProviderProfileRunnable(draft)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Provider configuration is incomplete",
        message: getAIProviderProfileValidationError(draft) ?? "Choose an available Raycast AI model.",
      });
      return;
    }

    testAbortController.current?.abort();
    const abortController = new AbortController();
    testAbortController.current = abortController;
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Testing ${draft.name || "AI provider"}...`,
    });

    try {
      const iterator = createAITranslationProvider(draft).request(
        { word: "Hello", fromLanguage: "en", toLanguage: "zh-CHS" },
        { signal: abortController.signal },
      );
      let translation = "";
      while (true) {
        const next = await iterator.next();
        if (next.done) {
          translation = next.value.translations[0]?.trim() ?? "";
          break;
        }
      }
      if (!translation) throw new Error("The provider returned an empty translation.");

      toast.style = Toast.Style.Success;
      toast.title = "Provider test succeeded";
      toast.message = `Hello → ${translation}`;
    } catch (error) {
      if (abortController.signal.aborted) return;
      toast.style = Toast.Style.Failure;
      toast.title = "Provider test failed";
      toast.message = normalizeError(error).message;
    } finally {
      if (testAbortController.current === abortController) {
        testAbortController.current = null;
      }
    }
  }

  const loadModels = useCallback(async () => {
    logTrace("AI Models", `load requested for profile: ${profile.name}`);
    const requestKey = modelCatalog.loadKey;
    if (!requestKey) {
      logTrace("AI Models", `load skipped for ${profile.name}: model catalog is not ready`);
      return;
    }

    if (loadedModelsKey.current === requestKey) {
      logTrace("AI Models", `load skipped for ${profile.name}: current configuration already loaded`);
      return;
    }
    if (loadingModelsKey.current === requestKey) {
      logTrace("AI Models", `load skipped for ${profile.name}: request already in progress`);
      return;
    }

    modelAbortController.current?.abort();
    const abortController = new AbortController();
    modelAbortController.current = abortController;
    loadingModelsKey.current = requestKey;
    const cachedModels = modelCatalog.getCachedOptions();
    if (cachedModels.length > 0) {
      setAvailableModels(cachedModels);
    }
    setIsLoadingModels(true);
    try {
      const models = await modelCatalog.loadOptions(abortController.signal);
      if (abortController.signal.aborted) {
        logTrace("AI Models", `discard fetched models for ${profile.name}: request cancelled`);
        return;
      }
      setAvailableModels(models);
      loadedModelsKey.current = requestKey;
    } catch (error) {
      if (abortController.signal.aborted) {
        logTrace("AI Models", `load cancelled for profile: ${profile.name}`);
        return;
      }
      const normalizedError = normalizeError(error);
      logWarn(
        "AI Models",
        `load failed for ${profile.name}, error type: ${error instanceof Error ? error.name : typeof error}`,
      );
      await showToast({
        style: Toast.Style.Failure,
        title: "Unable to fetch models",
        message: normalizedError.message,
      });
    } finally {
      if (modelAbortController.current === abortController) {
        modelAbortController.current = null;
        loadingModelsKey.current = null;
        setIsLoadingModels(false);
      }
    }
  }, [modelCatalog, profile.name]);

  useEffect(
    () => () => {
      testAbortController.current?.abort();
      modelAbortController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    modelAbortController.current?.abort();
    modelAbortController.current = null;
    loadedModelsKey.current = null;
    loadingModelsKey.current = null;
    setAvailableModels(modelCatalog.getCachedOptions());
    setModelSearchText("");
    setIsLoadingModels(false);
  }, [modelCatalog]);

  useEffect(() => {
    if (!modelCatalog.loadKey) return;
    const timer = setTimeout(() => void loadModels(), 300);
    return () => clearTimeout(timer);
  }, [loadModels, modelCatalog.loadKey]);

  const customModel = modelSearchText.trim();
  const modelOptions = mergeModelOptions(model, availableModels, modelCatalog.allowsCustomModel);

  return (
    <Form
      navigationTitle={profile.name}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Provider" icon={Icon.SaveDocument} onSubmit={submit} />
          <Action
            title="Test Provider"
            icon={Icon.Bolt}
            shortcut={{
              macOS: { modifiers: ["cmd"], key: "t" },
              Windows: { modifiers: ["ctrl"], key: "t" },
            }}
            onAction={testProvider}
          />
        </ActionPanel>
      }
    >
      {profile.adapter === "openai-compatible" && showPresetSelector && (
        <Form.Dropdown
          id="preset"
          title="Preset"
          value={presetName}
          onChange={(value) => selectPreset(value as OpenAICompatiblePresetName)}
        >
          {Object.entries(OPENAI_COMPATIBLE_PRESETS).map(([value, preset]) => (
            <Form.Dropdown.Item key={value} title={value === "custom" ? "Custom" : preset.name} value={value} />
          ))}
        </Form.Dropdown>
      )}
      <Form.TextField id="name" title="Name" value={name} onChange={setName} />
      {profile.adapter === "openai-compatible" && (
        <>
          <Form.TextField id="endpoint" title="API Base URL" value={endpoint} onChange={setEndpoint} />
          <Form.TextField id="website" title="Website (Optional)" value={website} onChange={setWebsite} />
          <Form.PasswordField id="apiKey" title="API Key" value={apiKey} onChange={setAPIKey} />
          <Form.Description
            title="Model Discovery"
            text="Enter a valid API key to load available models. You can also type a model name manually."
          />
        </>
      )}
      <Form.Dropdown
        id="model"
        title="Model"
        value={model}
        placeholder={modelCatalog.allowsCustomModel ? "Type or search models..." : "Search models..."}
        isLoading={isLoadingModels}
        onFocus={() => void loadModels()}
        onSearchTextChange={setModelSearchText}
        onChange={(value) => {
          setModel(value);
          setModelSearchText("");
        }}
      >
        {!model && modelCatalog.allowsCustomModel && <Form.Dropdown.Item value="" title="Type a Model Name" />}
        {modelCatalog.allowsCustomModel &&
          customModel &&
          !modelOptions.some((option) => option.value === customModel) && (
            <Form.Dropdown.Section title="Custom">
              <Form.Dropdown.Item value={customModel} title={`Use “${customModel}”`} />
            </Form.Dropdown.Section>
          )}
        <Form.Dropdown.Section title="Models">
          {modelOptions.map((option) => (
            <Form.Dropdown.Item key={option.value} value={option.value} title={option.title} />
          ))}
        </Form.Dropdown.Section>
      </Form.Dropdown>
      {profile.adapter === "openai-compatible" && (
        <Form.Dropdown
          id="tokenLimitMode"
          title="Token Parameter"
          value={tokenLimitMode}
          onChange={(value) => setTokenLimitMode(value as TokenLimitMode)}
        >
          <Form.Dropdown.Item title="max_tokens" value="max-tokens" />
          <Form.Dropdown.Item title="max_completion_tokens" value="max-completion-tokens" />
        </Form.Dropdown>
      )}
      <Form.Dropdown
        id="icon"
        title="Icon"
        value={iconSelection}
        onChange={(value) => setIconSelection(value as IconSelection)}
      >
        <Form.Dropdown.Item title="OpenAI" value="openai" />
        <Form.Dropdown.Item title="Gemini" value="gemini" />
        <Form.Dropdown.Item title="DeepSeek" value="deepseek" />
        <Form.Dropdown.Item title="OpenRouter" value="openrouter" />
        <Form.Dropdown.Item title="SiliconFlow" value="siliconflow" />
        <Form.Dropdown.Item title="Zhipu GLM" value="zhipu" />
        <Form.Dropdown.Item title="Kimi" value="kimi" />
        <Form.Dropdown.Item title="MiniMax" value="minimax" />
        <Form.Dropdown.Item title="Xiaomi MiMo" value="mimo" />
        <Form.Dropdown.Item title="Raycast" value="raycast" />
        <Form.Dropdown.Item title="Website Favicon" value="favicon" />
        <Form.Dropdown.Item title="Remote HTTPS Image" value="remote" />
        <Form.Dropdown.Item title="Initials" value="initials" />
      </Form.Dropdown>
      {iconSelection === "remote" && (
        <Form.TextField id="iconURL" title="Icon URL" value={iconURL} onChange={setIconURL} />
      )}
    </Form>
  );
}

function createOpenAIProfile(presetName: OpenAICompatiblePresetName, order: number): OpenAICompatibleProfile {
  const preset = OPENAI_COMPATIBLE_PRESETS[presetName];
  return {
    id: randomUUID(),
    adapter: "openai-compatible",
    enabled: true,
    order,
    apiKey: "",
    ...preset,
  };
}

function getIconConfig(selection: IconSelection, iconURL: string, website: string): ProviderIconConfig {
  switch (selection) {
    case "openai":
    case "gemini":
    case "deepseek":
    case "openrouter":
    case "siliconflow":
    case "zhipu":
    case "kimi":
    case "minimax":
    case "mimo":
    case "raycast":
      return { kind: "preset", name: selection };
    case "favicon":
      return { kind: "favicon", website: website.trim() || undefined };
    case "remote":
      return { kind: "remote", url: iconURL.trim() };
    case "initials":
      return { kind: "initials" };
  }
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
  };
}

function moveProfile(profiles: AIProviderProfile[], from: number, to: number): AIProviderProfile[] {
  const next = [...profiles];
  const [profile] = next.splice(from, 1);
  next.splice(to, 0, profile);
  return next;
}

function mergeModelOptions(
  model: string,
  availableModels: AIModelOption[],
  allowsCustomModel: boolean,
): AIModelOption[] {
  const currentModel = model.trim();
  const options = currentModel
    ? [
        {
          title: allowsCustomModel ? currentModel : `Unavailable: ${currentModel}`,
          value: currentModel,
        },
        ...availableModels,
      ]
    : availableModels;
  return [...new Map(options.map((option) => [option.value, option])).values()];
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
