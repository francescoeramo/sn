'use client';

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from 'react';
import { LANGUAGE_STORAGE_KEY, translateInterface, type AppLanguage } from '@/lib/client/i18n';

const LanguageContext = createContext<AppLanguage>('it');
const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const renderedAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ['aria-label', 'alt', 'placeholder', 'title'] as const;

function savedLanguage(): AppLanguage {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'it';
}

function translateTextNode(node: Text, language: AppLanguage) {
  const lastRendered = renderedText.get(node);
  if (!originalText.has(node) || (lastRendered !== undefined && node.data !== lastRendered)) {
    originalText.set(node, node.data);
  }
  const original = originalText.get(node) ?? node.data;
  const start = original.match(/^\s*/)?.[0] ?? '';
  const end = original.match(/\s*$/)?.[0] ?? '';
  const copy = original.slice(start.length, original.length - end.length);
  if (!copy) return;
  const translated = `${start}${translateInterface(copy.replace(/\s+/g, ' '), language)}${end}`;
  renderedText.set(node, translated);
  if (node.data !== translated) node.data = translated;
}

function translateElement(element: Element, language: AppLanguage) {
  let attributes = originalAttributes.get(element);
  if (!attributes) {
    attributes = new Map();
    originalAttributes.set(element, attributes);
  }
  let rendered = renderedAttributes.get(element);
  if (!rendered) {
    rendered = new Map();
    renderedAttributes.set(element, rendered);
  }
  for (const name of translatedAttributes) {
    const current = element.getAttribute(name);
    const lastRendered = rendered.get(name);
    if (
      current !== null &&
      (!attributes.has(name) || (lastRendered !== undefined && current !== lastRendered))
    ) {
      attributes.set(name, current);
    }
    const original = attributes.get(name);
    if (original !== undefined) {
      const translated = translateInterface(original, language);
      rendered.set(name, translated);
      if (current !== translated) element.setAttribute(name, translated);
    }
  }
}

function translateTree(root: Node, language: AppLanguage) {
  if (root instanceof Text) {
    translateTextNode(root, language);
    return;
  }
  if (!(root instanceof Element) || root.matches('script, style, [data-user-copy]')) return;
  translateElement(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node instanceof Element ? node : node.parentElement;
      return parent?.closest('script, style, [data-user-copy]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text) translateTextNode(node, language);
    else if (node instanceof Element) translateElement(node, language);
    node = walker.nextNode();
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore<AppLanguage>(
    (notify) => {
      const update = () => notify();
      addEventListener('storage', update);
      addEventListener('sn-language-change', update);
      return () => {
        removeEventListener('storage', update);
        removeEventListener('sn-language-change', update);
      };
    },
    savedLanguage,
    () => 'it' as AppLanguage,
  );

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.title = translateInterface(document.title, language);
    translateTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTextNode(mutation.target as Text, language);
        if (mutation.type === 'attributes') translateElement(mutation.target as Element, language);
        for (const node of mutation.addedNodes) translateTree(node, language);
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...translatedAttributes],
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [language]);

  return <LanguageContext value={language}>{children}</LanguageContext>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
