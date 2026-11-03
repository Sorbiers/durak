import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { FORTUNE_PAGES } from './src/fortune/seo';
import { TEXTS as FORTUNE_TEXTS } from './src/fortune/i18n';
import { LANGS, PAGES, SITE, type PageLang, type PageText, otherLangs } from './src/seo';
import { STRINGS } from './src/ui/i18n';

// The site has two parts, each a single page: the game, served at the site root, and the
// fortune-telling, in fortune/. Each is written out at four addresses: its own folder, which
// picks the language from the browser, and ru/, en/ and fr/ inside it, one language each. Search
// engines list a page by what its HTML says before any script runs, so every address gets its
// own title, description and texts, and names the others as its translations.
type Variant = 'root' | PageLang;
const LOCALE: Record<PageLang, string> = { ru: 'ru_RU', en: 'en_US', fr: 'fr_FR' };
const SITE_NAME = 'Podkidnoy';
// Names the game is also found by — promoted in the structured data for search engines.
const ALT_NAMES = ['Podkidnoy Durak', 'Подкидной дурак', 'Durak online', 'Дурак онлайн', 'Dourak', 'Дурак', 'Durak'];

interface Part {
  dir: string; // its folder under the site root: '' for the game
  html: string; // its page, as the build names it
  texts: Record<PageLang, PageText>;
  image: (lang: PageLang) => string; // the picture shown when a link is shared
  data: (lang: PageLang) => Record<string, unknown>; // structured data for search engines
  slots: (lang: PageLang) => Record<string, string>; // [[name]] in the page's HTML
}

const GAME: Part = {
  dir: '',
  html: 'index.html',
  texts: PAGES,
  image: (lang) => `og-${lang}.jpg`,
  data: (lang) => ({
    '@type': ['VideoGame', 'WebApplication'],
    name: STRINGS[lang].title,
    alternateName: [...new Set([...otherLangs(lang).map((l) => STRINGS[l].title), ...ALT_NAMES])].filter(
      (n) => n !== STRINGS[lang].title,
    ),
    genre: 'Card game',
    playMode: 'SinglePlayer',
    applicationCategory: 'GameApplication',
  }),
  slots: (lang) => ({ brand: STRINGS[lang].title, about: STRINGS[lang].about, close: STRINGS[lang].close }),
};

const FORTUNE: Part = {
  dir: 'fortune/',
  html: 'fortune/index.html',
  texts: FORTUNE_PAGES,
  image: (lang) => `og-fortune-${lang}.jpg`,
  data: (lang) => ({
    '@type': 'WebApplication',
    name: FORTUNE_TEXTS[lang].title,
    applicationCategory: 'EntertainmentApplication',
  }),
  slots: (lang) => ({
    brand: FORTUNE_TEXTS[lang].title,
    about: FORTUNE_TEXTS[lang].about,
    close: FORTUNE_TEXTS[lang].close,
    durak: FORTUNE_TEXTS[lang].durak,
  }),
};

const PARTS = [GAME, FORTUNE];

const urlOf = (v: Variant, part: Part): string => `${SITE}${part.dir}${v === 'root' ? '' : `${v}/`}`;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function head(v: Variant, part: Part): string {
  const lang: PageLang = v === 'root' ? 'en' : v;
  const { title, description } = part.texts[lang];
  const image = `${SITE}${part.image(lang)}`;
  const up = part.dir ? '../' : './'; // from the part's folder to the site root
  const data = {
    '@context': 'https://schema.org',
    ...part.data(lang),
    url: urlOf(v, part),
    description,
    image,
    inLanguage: LANGS,
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${urlOf(v, part)}" />`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlOf(l, part)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${urlOf('root', part)}" />`,
    `<link rel="icon" href="${up}favicon.ico" sizes="32x32" />`,
    `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${up}apple-touch-icon.png" />`,
    `<meta name="theme-color" content="#1d4a39" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${urlOf(v, part)}" />`,
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
function localize(html: string, v: Variant, part: Part): string {
  const lang: PageLang = v === 'root' ? 'en' : v;
  // The slots of the page: [[name]] in its HTML is replaced by the text of that name.
  const slots = part.slots(lang);
  // The language switch: a link to the page in each of the other languages.
  const switchTo = (cls: string): string =>
    otherLangs(lang)
      .map((l) => `<a class="${cls}" href="./${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
      .join('');
  const out = html
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace('<!--seo-head-->', () => head(v, part))
    .replace('<!--seo-about-->', () => part.texts[lang].about.trim())
    .replace(/<!--langs:(\w+)-->/, (_, cls: string) => switchTo(cls))
    .replace(/\[\[(\w+)\]\]/g, (whole, name: string) => (name in slots ? esc(slots[name]) : whole));
  // A language page sits one folder down, so its relative links climb one more.
  return v === 'root' ? out : out.replace(/\b(src|href)="(\.\.?)\//g, (_, attr, dots) => `${attr}="${dots === '.' ? '..' : '../..'}/`);
}

function sitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PARTS.flatMap((part) => {
    const links =
      LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlOf(l, part)}" />`).join('\n') +
      `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf('root', part)}" />`;
    return (['root', ...LANGS] as Variant[]).map(
      (v) => `  <url>\n    <loc>${urlOf(v, part)}</loc>\n    <lastmod>${today}</lastmod>\n${links}\n  </url>`,
    );
  }).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls}\n</urlset>\n`
  );
}

// A language address of either part: the part's folder, then the language.
const LANG_PAGE = /^\/(fortune\/)?(ru|en|fr)\/(?:index\.html)?(?:\?.*)?$/;

function pages(): Plugin {
  return {
    name: 'synarteum-pages',
    enforce: 'post',
    // While developing there is no build: the language addresses are served from the part's
    // page, filled in as it goes out.
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const m = (req.url ?? '').match(LANG_PAGE);
        if (m) req.url = `/${m[1] ?? ''}index.html`;
        next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html;
        const part = ctx.path.startsWith(`/${FORTUNE.dir}`) ? FORTUNE : GAME;
        const m = (ctx.originalUrl ?? '').match(LANG_PAGE);
        return localize(html, m ? (m[2] as PageLang) : 'root', part);
      },
    },
    generateBundle(_options, bundle) {
      for (const part of PARTS) {
        const page = bundle[part.html];
        if (!page || page.type !== 'asset') continue;
        const html = String(page.source);
        page.source = localize(html, 'root', part);
        for (const lang of LANGS) {
          this.emitFile({ type: 'asset', fileName: `${part.dir}${lang}/index.html`, source: localize(html, lang, part) });
        }
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
    },
  };
}

const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// A page cannot list a folder, so which pictures each character has is read from their folders
// here, <mood>_<0..9>.webp, and handed to the game as the module `virtual:portraits`. Adding or
// removing a picture is all it takes, and the dev server reloads the page when that happens.
// A numbered folder inside a character's own, such as sonya/2, is a second view of them, taken
// from further off or closer in; it is listed under that path.
function portraits(): Plugin {
  const name = 'virtual:portraits';
  const resolved = `\0${name}`;
  const folder = at('./public/avatars');
  return {
    name: 'portraits',
    resolveId: (id) => (id === name ? resolved : undefined),
    load(id) {
      if (id !== resolved) return undefined;
      const found: Record<string, Record<string, number[]>> = {};
      const read = (path: string): void => {
        const moods: Record<string, number[]> = {};
        for (const entry of readdirSync(`${folder}/${path}`, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
          if (entry.isDirectory() && /^\d$/.test(entry.name)) read(`${path}/${entry.name}`);
          const m = /^([a-z]+)_(\d)\.webp$/.exec(entry.name);
          if (m) (moods[m[1]!] ??= []).push(Number(m[2]));
        }
        if (!moods.neutral) this.error(`public/avatars/${path} has no neutral_<0..9>.webp`);
        found[path] = moods;
      };
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.isDirectory()) read(entry.name);
      }
      return `export default ${JSON.stringify(found)};`;
    },
    configureServer(server) {
      const changed = (file: string): void => {
        if (!/public[\\/]avatars[\\/]/.test(file)) return;
        const module = server.moduleGraph.getModuleById(resolved);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', changed).on('unlink', changed);
    },
  };
}

// Relative asset paths, so the built site works from any folder on a web server.
export default defineConfig({
  base: './',
  plugins: [pages(), portraits()],
  build: { rollupOptions: { input: { index: at('./index.html'), fortune: at('./fortune/index.html') } } },
});
