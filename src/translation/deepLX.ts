import { QueryWordInfo } from "../dictionary/youdao/types";
import axios from "axios";

export const requestDeepLXTranslate = async (queryWordInfo: QueryWordInfo): Promise<{ translations: string[] }> => {
  const body = await axios.post<{ data: string }>("https://deeplx.mingming.dev/translate", {
    text: queryWordInfo.word,
    source_lang: queryWordInfo.fromLanguage,
    target_lang: queryWordInfo.toLanguage.split("-")[0],
  });
  return {
    translations: [body.data.data],
  };
};
