/**
 * Mock implementation of whatlang-node for Raycast compatibility
 * Returns fixed values since Easydict handles language detection internally
 */

export function detectLang(text, iso6393 = false) {
  return iso6393 ? "eng" : "English";
}

export function detectScript(text) {
  return "Latin";
}
