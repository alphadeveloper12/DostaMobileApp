/**
 * i18nText — global <Text> patch that makes every Text in the app react to
 * the current language. Equivalent to what the Google Translate widget
 * does on the web (where it walks the DOM and replaces text nodes).
 *
 * The patch is a one-time side-effect: importing this file in App.tsx
 * (BEFORE the first render) replaces React Native's `Text.render` with a
 * wrapped version that:
 *
 *   1. Runs the original render to get the underlying Text element.
 *   2. Walks `props.children` and wraps any string segments in a small
 *      <PerString> component that subscribes to the *specific* cache key
 *      for that string. Only the affected Text re-renders when its
 *      translation arrives — no global app re-render storm.
 *
 * The patch is a no-op when current language is 'en'.
 */

import React, { useEffect, useReducer } from 'react';
import { Text } from 'react-native';
import {
  getLang,
  subscribeLang,
  subscribeCacheKey,
  translateText,
  translationKey,
} from './i18n';

// One-shot subscription to the *current* string's translation cache slot.
// The component re-renders when:
//   • the language changes globally (subscribeLang)
//   • the translation for *this exact phrase* arrives (subscribeCacheKey)
const PerString: React.FC<{ text: string }> = ({ text }) => {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const lang = getLang();

  useEffect(() => subscribeLang(force), []);
  useEffect(() => {
    if (lang === 'en') return;
    return subscribeCacheKey(translationKey(text, lang), force);
  }, [text, lang]);

  return <>{translateText(text, lang)}</>;
};

// Walk children and wrap each string segment. Non-string children (numbers,
// elements) pass through untouched. Nested <Text> are themselves patched, so
// their own children get translated when they render.
const wrapChildren = (children: React.ReactNode): React.ReactNode => {
  if (children == null) return children;

  if (typeof children === 'string') {
    return <PerString text={children} />;
  }

  if (Array.isArray(children)) {
    return children.map((c, i) =>
      typeof c === 'string'
        ? <PerString key={`__t_${i}`} text={c} />
        : c,
    );
  }

  return children;
};

let installed = false;

export const installI18nTextPatch = () => {
  if (installed) return;
  installed = true;

  // RN's Text is a forwardRef whose inner render fn lives at .render.
  const TextAny = Text as unknown as {
    render?: (props: any, ref: any) => React.ReactElement;
  };
  const orig = TextAny.render;
  if (typeof orig !== 'function') return;            // bail if RN ever changes shape

  TextAny.render = function patchedTextRender(props: any, ref: any) {
    // English mode is a hot path — skip wrapping entirely.
    if (getLang() === 'en') return orig(props, ref);

    const children = props?.children;
    // Quick reject: nothing translatable here.
    if (children == null) return orig(props, ref);
    const hasString =
      typeof children === 'string' ||
      (Array.isArray(children) && children.some(c => typeof c === 'string'));
    if (!hasString) return orig(props, ref);

    return orig({ ...props, children: wrapChildren(children) }, ref);
  };
};
