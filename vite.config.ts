import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { LANGS, PAGES, SITE, type PageLang, otherLangs } from './src/seo';
import { STRINGS } from './src/ui/i18n';

// The game is a single page, served at the site root and written out at four addresses: its
// own root, which picks the language from the browser, and ru/, en/ and fr/, one language
// each. Search engines list a page by what its HTML says before any script runs, so every
// address gets its own title, description and texts, and names the others as its translations.
type Variant = 'root' | PageLang;
const LOCALE: Record<PageLang, string> = { ru: 'ru_RU', en: 'en_US', fr: 'fr_FR' };
const SITE_NAME = 'Podkidnoy';
// Names the game is also found by — promoted in the structured data for search engines.
const ALT_NAMES = ['Podkidnoy Durak', 'Подкидной дурак', 'Durak online', 'Дурак онлайн', 'Dourak', 'Дурак', 'Durak'];

const urlOf = (v: Variant): string => (v === 'root' ? SITE : `${SITE}${v}/`);
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function head(v: Variant): string {
  const lang: PageLang = v === 'root' ? 'en' : v;
  const { title, description } = PAGES[lang];
  const image = `${SITE}og-${lang}.jpg`;
  const data = {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'WebApplication'],
    name: STRINGS[lang].title,
    alternateName: [...new Set([...otherLangs(lang).map((l) => STRINGS[l].title), ...ALT_NAMES])].filter(
      (n) => n !== STRINGS[lang].title,
    ),
    url: urlOf(v),
    description,
    image,
    inLanguage: LANGS,
    genre: 'Card game',
    playMode: 'SinglePlayer',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${urlOf(v)}" />`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlOf(l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${urlOf('root')}" />`,
    `<link rel="icon" href="./favicon.ico" sizes="32x32" />`,
    `<link rel="icon" href="./favicon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="./apple-touch-icon.png" />`,
    `<meta name="theme-color" content="#1d4a39" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${urlOf(v)}" />`,
    `<meta property="og:locale" content="${LOCALE[lang]}" />`,
    ...otherLangs(lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}" />`),
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    // Structured data, not a script that runs; "<" is escaped so no text can close the tag.
    `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
}

/** Fills in what the page says about itself, for one address. */
function localize(html: string, v: Variant): string {
  const lang: PageLang = v === 'root' ? 'en' : v;
  // The slots of the page: [[name]] in its HTML is replaced by the text of that name.
  const slots: Record<string, string> = {
    brand: STRINGS[lang].title,
    about: STRINGS[lang].about,
    close: STRINGS[lang].close,
  };
  // The language switch: a link to the page in each of the other languages.
  const switchTo = (cls: string): string =>
    otherLangs(lang)
      .map((l) => `<a class="${cls}" href="./${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
      .join('');
  const out = html
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace('<!--seo-head-->', () => head(v))
    .replace('<!--seo-about-->', () => PAGES[lang].about.trim())
    .replace(/<!--langs:(\w+)-->/, (_, cls: string) => switchTo(cls))
    .replace(/\[\[(\w+)\]\]/g, (whole, name: string) => (name in slots ? esc(slots[name]) : whole));
  // A language page sits one folder down, so its relative links climb one more.
  return v === 'root' ? out : out.replace(/\b(src|href)="(\.\.?)\//g, (_, attr, dots) => `${attr}="${dots === '.' ? '..' : '../..'}/`);
}

function sitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  const links =
    LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlOf(l)}" />`).join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf('root')}" />`;
  const urls = (['root', ...LANGS] as Variant[])
    .map((v) => `  <url>\n    <loc>${urlOf(v)}</loc>\n    <lastmod>${today}</lastmod>\n${links}\n  </url>`)
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls}\n</urlset>\n`
  );
}

const LANG_PAGE = /^\/(ru|en|fr)\/(?:index\.html)?(?:\?.*)?$/;

function pages(): Plugin {
  return {
    name: 'synarteum-pages',
    enforce: 'post',
    // While developing there is no build: the language addresses are served from the same
    // page, filled in as it goes out.
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (LANG_PAGE.test(req.url ?? '')) req.url = '/index.html';
        next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html;
        const m = (ctx.originalUrl ?? '').match(LANG_PAGE);
        return localize(html, m ? (m[1] as PageLang) : 'root');
      },
    },
    generateBundle(_options, bundle) {
      const page = bundle['index.html'];
      if (page && page.type === 'asset') {
        const html = String(page.source);
        page.source = localize(html, 'root');
        for (const lang of LANGS) {
          this.emitFile({ type: 'asset', fileName: `${lang}/index.html`, source: localize(html, lang) });
        }
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
    },
  };
}

const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// Relative asset paths, so the built site works from any folder on a web server.
export default defineConfig({
  base: './',
  plugins: [pages()],
  build: { rollupOptions: { input: { index: at('./index.html') } } },
});
