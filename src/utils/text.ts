/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

/**
 * Trim the text to the max length, default 1830.
 *
 * * Note: google web translate max length is 1830.
 */
export function trimTextLength(text: string, length = 1830) {
  text = text.trim();
  if (text.length > length) {
    return text.substring(0, length) + "...";
  }
  return text.substring(0, length);
}
