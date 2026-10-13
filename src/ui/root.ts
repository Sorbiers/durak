import type { PageLang } from '../seo';

// Each part of the site, the front page and the game alike, has three addresses: its own
// folder, which picks a language from the browser, and ru/ and en/ inside it, which are in
// one language each so that search engines can list them separately.
const match = location.pathname.match(/\/(ru|en)\/(?:index\.html)?$/);

/** The language of the page's address, if it has one. */
export const PAGE_LANG: PageLang | undefined = match ? (match[1] as PageLang) : undefined;

/** The address of this part's own folder, where its pictures and sounds live. */
export const ROOT: string = new URL(match ? '../' : './', location.href).href;

/** The first of the browser's preferred languages that the site speaks; English failing both. */
export function browserLang(): PageLang {
  const wanted = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of wanted) {
    const code = tag.toLowerCase().split('-')[0];
    if (code === 'ru' || code === 'en') return code;
  }
  return 'en';
}
