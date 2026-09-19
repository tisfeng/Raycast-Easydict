import { myPreferences } from "@/consts";
import { detectLanguage } from "@/core/detect";
import { englishLanguageItem } from "@/core/language/consts";
import type { LanguageItem } from "@/core/language/types";
import { getLanguageItem } from "@/core/language/utils";
import type {
  QueryInput,
  QueryResult,
  QueryWordInfo,
  RuntimeServiceConfig,
  TranslationResult,
} from "@/core/results/types";
import type { DictionaryServiceConfig } from "@/providers/dictionary";
import type { TranslationServiceConfig } from "@/providers/translation";
import { CancelledError, RequestError } from "@/shared/errors";

import {
  cacheLanguageDetection,
  cacheQueryResult,
  getCachedLanguageDetection,
  getCachedQueryResult,
  getQueryCacheGeneration,
} from "./cache";
import { getAutoSelectedTargetLanguageItem } from "./utils";

export interface QueryServiceSnapshot {
  translationServices: TranslationServiceConfig[];
  dictionaryServices: DictionaryServiceConfig[];
}

interface QueryOptions {
  bypassCache?: boolean;
}

interface ServiceRequest {
  serviceId: string;
  controller: AbortController;
  signal: AbortSignal;
  running: boolean;
}

interface ServiceEntry {
  request: ServiceRequest;
  result?: QueryResult;
}

interface QuerySession {
  controller: AbortController;
  phase: { kind: "detecting" } | { kind: "ready"; input: QueryInput } | { kind: "failed" };
  cacheGeneration: number;
  entries: Map<string, ServiceEntry>;
  audioPlayed: boolean;
}

export interface QuerySnapshot {
  readonly queryResults: readonly QueryResult[];
  queryGeneration: number;
  isLoading: boolean;
  currentFromLanguageItem: LanguageItem;
  autoSelectedTargetLanguageItem: LanguageItem;
}

interface QueryEffects {
  onError: (error: unknown) => void;
  onAudio: (word: QueryWordInfo, signal: AbortSignal) => void;
}

function serviceMetadata(service: RuntimeServiceConfig) {
  return { serviceId: service.id, serviceLabel: service.label, serviceOrder: service.order, serviceIcon: service.icon };
}

/** Owns one command's active query and service requests; React only subscribes. */
export class QueryRunner {
  private session?: QuerySession;
  private listeners = new Set<() => void>();
  private snapshot: QuerySnapshot;

  constructor(
    initialFromLanguage: LanguageItem,
    initialTargetLanguage: LanguageItem,
    private services: QueryServiceSnapshot,
    private effects: QueryEffects,
  ) {
    this.snapshot = {
      queryResults: [],
      queryGeneration: 0,
      isLoading: false,
      currentFromLanguageItem: initialFromLanguage,
      autoSelectedTargetLanguageItem: initialTargetLanguage,
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish() {
    const session = this.session;
    this.snapshot = {
      ...this.snapshot,
      queryResults: [...(session?.entries.values() ?? [])]
        .flatMap((entry) => (entry.result ? [entry.result] : []))
        .sort((left, right) => left.serviceOrder - right.serviceOrder),
      isLoading:
        !!session &&
        (session.phase.kind === "detecting" || [...session.entries.values()].some((entry) => entry.request.running)),
    };
    for (const listener of this.listeners) listener();
  }

  private isCurrent(session: QuerySession, request?: ServiceRequest) {
    return (
      this.session === session &&
      !session.controller.signal.aborted &&
      (!request || (request.running && session.entries.get(request.serviceId)?.request === request))
    );
  }

  private begin(input?: QueryInput) {
    this.dispose();
    const session: QuerySession = {
      controller: new AbortController(),
      phase: input ? { kind: "ready", input } : { kind: "detecting" },
      cacheGeneration: getQueryCacheGeneration(),
      entries: new Map(),
      audioPlayed: false,
    };
    this.session = session;
    this.snapshot = { ...this.snapshot, queryGeneration: this.snapshot.queryGeneration + 1 };
    this.publish();
    return session;
  }

  dispose = () => {
    this.session?.controller.abort();
    for (const entry of this.session?.entries.values() ?? []) entry.request.controller.abort();
  };

  clearQueryResult = () => {
    this.dispose();
    this.session = undefined;
    this.snapshot = { ...this.snapshot, queryGeneration: this.snapshot.queryGeneration + 1 };
    this.publish();
  };

  setAutoSelectedTargetLanguageItem = (item: LanguageItem) => {
    this.snapshot = { ...this.snapshot, autoSelectedTargetLanguageItem: item };
    this.publish();
  };

  queryTextWithTextInfo = (input: QueryInput, options?: QueryOptions) => {
    this.runAll(this.begin(input), input, options?.bypassCache === true);
  };

  queryText = (text: string, toLanguage: string, options?: QueryOptions) => {
    const session = this.begin();
    const bypassCache = options?.bypassCache === true;
    void this.detect(session, text, toLanguage, bypassCache);
  };

  private async detect(session: QuerySession, text: string, toLanguage: string, bypassCache: boolean) {
    try {
      const cached = bypassCache ? undefined : getCachedLanguageDetection(text);
      const detection = cached ?? (await detectLanguage(text, session.controller.signal));
      if (!this.isCurrent(session)) return;
      if (!cached) cacheLanguageDetection(text, detection, session.cacheGeneration);
      const fromLanguage = detection.youdaoLangCode;
      const target =
        fromLanguage === toLanguage ? getAutoSelectedTargetLanguageItem(fromLanguage) : getLanguageItem(toLanguage);
      const input = { word: text, fromLanguage, toLanguage: target.youdaoLangCode };
      session.phase = { kind: "ready", input };
      this.snapshot = {
        ...this.snapshot,
        currentFromLanguageItem: getLanguageItem(fromLanguage),
        autoSelectedTargetLanguageItem: target,
      };
      this.runAll(session, input, bypassCache);
    } catch (error) {
      if (!this.isCurrent(session)) return;
      session.phase = { kind: "failed" };
      this.publish();
      this.effects.onError(error);
    }
  }

  private runAll(session: QuerySession, input: QueryInput, bypassCache: boolean) {
    for (const service of this.services.dictionaryServices)
      void this.runDictionary(service, session, input, bypassCache);
    for (const service of this.services.translationServices)
      void this.runTranslation(service, session, input, bypassCache);
    if (session.entries.size === 0) this.publish();
  }

  setServices = (services: QueryServiceSnapshot) => {
    const previous = this.services;
    this.services = services;
    const session = this.session;
    if (session?.phase.kind !== "ready" || !this.isCurrent(session)) return;
    const { input } = session.phase;
    const previousIds = new Set(
      [...previous.dictionaryServices, ...previous.translationServices].map((service) => service.id),
    );
    for (const service of services.dictionaryServices) {
      if (!previousIds.has(service.id)) void this.runDictionary(service, session, input, false);
    }
    for (const service of services.translationServices) {
      if (!previousIds.has(service.id)) void this.runTranslation(service, session, input, false);
    }
  };

  regenerateService = (serviceId: string) => {
    const session = this.session;
    if (session?.phase.kind !== "ready" || !this.isCurrent(session)) return;
    const { input } = session.phase;
    const cacheGeneration = getQueryCacheGeneration();
    const dictionary = this.services.dictionaryServices.find((service) => service.id === serviceId);
    if (dictionary) {
      void this.runDictionary(dictionary, session, input, true, cacheGeneration);
      return;
    }
    const translation = this.services.translationServices.find((service) => service.id === serviceId);
    if (translation) void this.runTranslation(translation, session, input, true, cacheGeneration);
  };

  private beginRequest(serviceId: string, session: QuerySession) {
    const previous = session.entries.get(serviceId);
    previous?.request.controller.abort();
    const controller = new AbortController();
    const request = {
      serviceId,
      controller,
      signal: AbortSignal.any([session.controller.signal, controller.signal]),
      running: true,
    };
    session.entries.set(serviceId, { request, result: previous?.result });
    this.publish();
    return request;
  }

  private accept(session: QuerySession, result: QueryResult) {
    const entry = session.entries.get(result.serviceId)!;
    entry.result = result;
    // Preserve arrival order when services have equal configured order, including regeneration.
    session.entries.delete(result.serviceId);
    session.entries.set(result.serviceId, entry);
  }

  private finish(session: QuerySession, service: RuntimeServiceConfig, request: ServiceRequest, error?: unknown) {
    if (!this.isCurrent(session, request)) return;
    request.running = false;
    this.publish();
    if (error !== undefined)
      this.effects.onError(
        error instanceof RequestError ? new RequestError(service.label, error.message, error.code) : error,
      );
  }

  private async runTranslation(
    service: TranslationServiceConfig,
    session: QuerySession,
    input: QueryInput,
    bypassCache: boolean,
    cacheGeneration = session.cacheGeneration,
  ) {
    if (!service.enabled(input)) return;
    const request = this.beginRequest(service.id, session);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let text = "";
    const accept = (result: TranslationResult, fromCache = false) => {
      if (!result.translations.join(", ").trim()) return false;
      this.accept(session, { ...result, ...serviceMetadata(service), ...(fromCache ? { fromCache } : {}) });
      return true;
    };
    try {
      const cached = bypassCache ? undefined : getCachedQueryResult(service, input);
      if (cached && "translations" in cached) {
        accept(cached, true);
      } else {
        const iterator = service.createProvider().request(input, { signal: request.signal });
        while (true) {
          const { done, value } = await iterator.next();
          if (!this.isCurrent(session, request)) {
            if (!done) await iterator.throw(new CancelledError());
            return;
          }
          if (done) {
            clearTimeout(timer);
            if (value && accept(value)) cacheQueryResult(service, input, value, cacheGeneration);
            break;
          }
          text += value.content;
          if (!timer)
            timer = setTimeout(() => {
              timer = undefined;
              if (
                this.isCurrent(session, request) &&
                accept({ type: service.type, queryWordInfo: input, translations: [text] })
              )
                this.publish();
            }, 80);
        }
      }
      this.finish(session, service, request);
    } catch (error) {
      this.finish(session, service, request, error);
    } finally {
      clearTimeout(timer);
    }
  }

  private async runDictionary(
    service: DictionaryServiceConfig,
    session: QuerySession,
    input: QueryInput,
    bypassCache: boolean,
    cacheGeneration = session.cacheGeneration,
  ) {
    if (!service.enabled(input)) return;
    const request = this.beginRequest(service.id, session);
    try {
      const cached = bypassCache ? undefined : getCachedQueryResult(service, input);
      const fromCache = cached !== undefined && !("translations" in cached);
      const result = fromCache ? cached : await service.createProvider().request(input, { signal: request.signal });
      if (!this.isCurrent(session, request)) return;
      if (result.displaySections?.length) {
        if (!fromCache) cacheQueryResult(service, input, result, cacheGeneration);
        this.accept(session, {
          ...result,
          ...serviceMetadata(service),
          displaySections: result.displaySections,
          fromCache,
        });
        const word = result.queryWordInfo;
        if (
          myPreferences.enableAutomaticPlayWordAudio &&
          service.canTriggerAutomaticAudio &&
          word.isWord &&
          word.fromLanguage === englishLanguageItem.youdaoLangCode &&
          !session.audioPlayed
        ) {
          session.audioPlayed = true;
          this.effects.onAudio(word, request.signal);
        }
      }
      this.finish(session, service, request);
    } catch (error) {
      this.finish(session, service, request, error);
    }
  }
}
