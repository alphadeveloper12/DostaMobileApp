/**
 * i18n — language switching for Dosta mobile.
 *
 * Mirrors what the web app does: the web sets the `googtrans` cookie and
 * the Google Translate Widget walks the DOM, replacing every text node.
 * RN has no DOM, so we do the equivalent by:
 *
 *   1. Maintaining a current language ('en' | 'ar') persisted in AsyncStorage.
 *   2. Patching `Text.render` once at app boot so every <Text> in the app —
 *      whether ours or third-party — runs its string children through the
 *      translator on render. (See `i18nText.tsx` for the patch + per-Text
 *      subscription wrapper.)
 *   3. Translating English strings to Arabic via Google's *free* unofficial
 *      endpoint (`translate.googleapis.com/translate_a/single`), the same
 *      service the Google Translate Widget uses behind the scenes. No API
 *      key required, but it's rate-limited — so we cache aggressively to
 *      AsyncStorage so each unique phrase is only fetched once per device.
 *
 * Usage:
 *   import { getLang, setLang, toggleLang, useLang, translateText, initLang } from '@/utils/i18n';
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useReducer } from 'react';

export type Lang = 'en' | 'ar';

const LANG_KEY  = 'app_lang';
const CACHE_KEY = 'app_translation_cache';

let currentLang: Lang = 'en';

// Translation cache. Keys: `${lang}::${sourceText}` → translated string.
// Async-persisted to AsyncStorage so repeat sessions are instant.
const cache = new Map<string, string>();

// In-flight fetches — dedupe so we don't hit the same translation twice.
const inFlight = new Set<string>();

// ─── pub/sub ──────────────────────────────────────────────────────────────
type Listener = () => void;
const langListeners = new Set<Listener>();
// Per-cache-key listeners. Lets each <Text> subscribe to *its* phrase only,
// so we don't re-render every Text in the tree on every cache write.
const cacheKeyListeners = new Map<string, Set<Listener>>();

const notifyLang  = () => { for (const fn of langListeners) fn(); };
const notifyCache = (key: string) => {
  const set = cacheKeyListeners.get(key);
  if (!set) return;
  for (const fn of set) fn();
};

export const subscribeLang = (fn: Listener) => {
  langListeners.add(fn);
  return () => { langListeners.delete(fn); };
};

export const subscribeCacheKey = (key: string, fn: Listener) => {
  let set = cacheKeyListeners.get(key);
  if (!set) { set = new Set(); cacheKeyListeners.set(key, set); }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) cacheKeyListeners.delete(key);
  };
};

// ─── persistence ──────────────────────────────────────────────────────────
// Debounced flush so we don't hammer AsyncStorage on every API response.
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const persistCache = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    const obj: Record<string, string> = {};
    for (const [k, v] of cache) obj[k] = v;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(obj)).catch(() => {});
  }, 1000);
};

export const initLang = async () => {
  try {
    const stored = (await AsyncStorage.getItem(LANG_KEY)) as Lang | null;
    if (stored === 'en' || stored === 'ar') currentLang = stored;
  } catch {}
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(obj)) cache.set(k, v);
    }
  } catch {}
};

export const getLang = () => currentLang;

export const setLang = async (next: Lang) => {
  if (next === currentLang) return;
  currentLang = next;
  try { await AsyncStorage.setItem(LANG_KEY, next); } catch {}
  notifyLang();
};

export const toggleLang = () =>
  setLang(currentLang === 'en' ? 'ar' : 'en');

// ─── translation API ──────────────────────────────────────────────────────
// Don't bother sending these to the network — they're not text.
const isUntranslatable = (text: string): boolean => {
  if (!text) return true;
  if (!text.trim()) return true;
  // Pure numbers / punctuation / currency symbols / whitespace.
  if (/^[\s\d.,:;%/+\-()*$£€¥–—_'"`!?@#&\\]+$/.test(text)) return true;
  // Already Arabic (don't double-translate).
  if (/[؀-ۿ]/.test(text)) return true;
  return false;
};

const fetchTranslation = async (text: string, target: Lang) => {
  const key = `${target}::${text}`;
  if (cache.has(key) || inFlight.has(key)) return;
  inFlight.add(key);
  try {
    // Free unofficial endpoint used by the Google Translate widget itself.
    // Returns: [[["مرحبا","hello",null,null,1]], …]
    const url =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const segments: any[] = data?.[0] || [];
    const out = segments.map(seg => seg?.[0] || '').join('');
    if (!out) return;
    cache.set(key, out);
    persistCache();
    notifyCache(key);
  } catch {
    // Silent — fall back to English.
  } finally {
    inFlight.delete(key);
  }
};

/**
 * Synchronous translator. Returns cached translation if available, else
 * fires off an async fetch and returns the original text. The patched
 * <Text> subscribes to `subscribeCacheKey(...)` so it'll re-render once
 * the translation arrives.
 */
export const translateText = (text: string, lang: Lang): string => {
  if (lang === 'en') return text;
  if (isUntranslatable(text)) return text;
  const key = `${lang}::${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Fire-and-forget; subscribers get notified when it lands.
  fetchTranslation(text, lang);
  return text;
};

/** Cache key used by the Text patch's subscription. */
export const translationKey = (text: string, lang: Lang) => `${lang}::${text}`;

// ─── React hook ───────────────────────────────────────────────────────────
/**
 * Subscribe a component to language changes. Returns the current language;
 * the component re-renders whenever the language flips.
 */
export const useLang = (): Lang => {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeLang(force), []);
  return currentLang;
};
