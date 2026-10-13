import type { PageLang } from '../seo';

// Each part of the site, the front page and the game alike, has four addresses: its own
// folder, which picks a language from the browser, and ru/, en/ and fr/ inside it, which are
// in one language each so that search engines can list them separately.
//
// The script that prepares the voices reads the characters without a browser, so nothing
// here may assume there is a page.
const page = typeof location === 'undefined' ? undefined : location;
const match = page?.pathname.match(/\/(ru|en|fr)\/(?:index\.html)?$/) ?? null;

/** The language of the page's address, if it has one. */
export const PAGE_LANG: PageLang | undefined = match ? (match[1] as PageLang) : undefined;

/** The address of this part's own folder, where its pictures and sounds live. */
export const ROOT: string = page ? new URL(match ? '../' : './', page.href).href : './';

/** The first of the browser's preferred languages that the site speaks; English failing both. */
export function browserLang(): PageLang {
  const wanted = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of wanted) {
    const code = tag.toLowerCase().split('-')[0];
    if (code === 'ru' || code === 'en' || code === 'fr') return code;
  }
  return 'en';
}
