import { timedFetch } from "@/fetchConfig";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { logTrace, logError } from "@/devLog";
import { AppKeyStore } from "@/preferences";
import { GeminiTranslateResult, QueryTypeResult, RequestErrorInfo, TranslationType } from "@/types";
import { getErrorMessage, getErrorName } from "@/utils";

/**
 * Gemini translate API using REST request
 */
export async function requestGeminiTranslate(
  queryWordInfo: QueryWordInfo,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("gemini", "start request Gemini");
  const { word, fromLanguage, toLanguage } = queryWordInfo;
  const type = TranslationType.Gemini;
  const apiKey = AppKeyStore.geminiAPIKey;
  const endpoint = AppKeyStore.geminiEndpoint;
  const model = AppKeyStore.geminiModel || "gemini-2.0-flash";

  // Check if API key exists
  if (!apiKey) {
    const errorInfo: RequestErrorInfo = {
      type: type,
      message: "No Gemini API key",
    };
    return Promise.reject(errorInfo);
  }

  // Construct prompt for translation
  const prompt = `Translate the following text from ${fromLanguage} to ${toLanguage}. Only return the translated text without any additional explanation or context:
${word}`;

  const url = `${endpoint}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const data = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  return new Promise((resolve, reject) => {
    timedFetch(url, {
      method: "POST",
      body: data,
      headers: { "Content-Type": "application/json" },
      signal,
    })
      .then((response) => {
        const result = response;
        logTrace("gemini", `translate result: ${JSON.stringify(result)}`);

        if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error("Empty response from Gemini API");
        }

        const translatedText = result.candidates[0].content.parts[0].text.trim();
        logTrace("gemini", `translate result: ${translatedText}`);

        const geminiResult: GeminiTranslateResult = {
          translatedText: translatedText,
        };

        const typeResult: QueryTypeResult = {
          type: TranslationType.Gemini,
          result: geminiResult,
          translations: [translatedText],
          queryWordInfo: queryWordInfo,
          oneLineTranslation: translatedText,
        };

        resolve(typeResult);
      })
      .catch((error) => {
        if (getErrorName(error) === "AbortError" || getErrorMessage(error) === "canceled") {
          logTrace("gemini", "canceled");
          return reject(undefined);
        }

        const message = getErrorMessage(error);
        logError("gemini", `translate error: ${message}`);
        const errorInfo: RequestErrorInfo = {
          type: type,
          message: message,
        };
        reject(errorInfo);
      });
  });
}
