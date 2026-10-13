import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { COFFEE, DREAM, GAME, LANDING, LANGS, PAGES, SITE, type PageLang, otherLangs } from './src/seo';
import { STRINGS } from './src/ui/i18n';

// The site has two parts, each a single page: the front page at the root and the game in
// durak/. Each part is written out at four addresses: its own folder, which picks the
// language from the browser, and ru/, en/ and fr/ inside it, one language each. Search
// engines list a page by what its HTML says before any script runs, so every address gets
// its own title, description and texts, and names the others as its translations.
type Part = 'landing' | 'durak';
type Variant = 'root' | PageLang;
const PARTS: Record<Part, { file: string; url: string }> = {
  landing: { file: 'index.html', url: SITE },
  durak: { file: 'durak/index.html', url: GAME },
};
const LOCALE: Record<PageLang, string> = { ru: 'ru_RU', en: 'en_US', fr: 'fr_FR' };
const MUSEUM = 'SynArteum';

const urlOf = (part: Part, v: Variant): string => (v === 'root' ? PARTS[part].url : `${PARTS[part].url}${v}/`);
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function head(part: Part, v: Variant): string {
  const lang: PageLang = v === 'root' ? 'en' : v;
  const { title, description } = part === 'durak' ? PAGES[lang] : LANDING[lang];
  const image = `${PARTS[part].url}og-${lang}.jpg`;
  const museum = { '@type': 'WebSite', name: MUSEUM, url: SITE };
  const data =
    part === 'durak'
      ? {
          '@context': 'https://schema.org',
          '@type': ['VideoGame', 'WebApplication'],
          name: STRINGS[lang].title,
          alternateName: otherLangs(lang).map((l) => STRINGS[l].title),
          url: urlOf(part, v),
          description,
          image,
          inLanguage: LANGS,
          genre: 'Card game',
          playMode: 'SinglePlayer',
          applicationCategory: 'GameApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          isPartOf: museum,
        }
      : {
          '@context': 'https://schema.org',
          ...museum,
          alternateName: 'Synthetic Art Museum',
          description,
          image,
          inLanguage: LANGS,
        };
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${urlOf(part, v)}" />`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlOf(part, l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${urlOf(part, 'root')}" />`,
    `<link rel="icon" href="./favicon.ico" sizes="32x32" />`,
    `<link rel="icon" href="./favicon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="./apple-touch-icon.png" />`,
    `<meta name="theme-color" content="${part === 'durak' ? '#1d4a39' : '#05060b'}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${MUSEUM}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${urlOf(part, v)}" />`,
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

/** Fills in what a page says about itself, for one address. */
function localize(html: string, part: Part, v: Variant): string {
  const lang: PageLang = v === 'root' ? 'en' : v;
  // The slots of the page: [[name]] in its HTML is replaced by the text of that name.
  const slots: Record<string, string> =
    part === 'durak'
      ? { brand: STRINGS[lang].title, about: STRINGS[lang].about, close: STRINGS[lang].close }
      : { ...LANDING[lang], dream: DREAM, coffee: COFFEE, langdir: v === 'root' ? '' : `${v}/` };
  // The language switch: a link to the page in each of the other languages.
  const switchTo = (cls: string): string =>
    otherLangs(lang)
      .map((l) => `<a class="${cls}" href="./${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
      .join('');
  const out = html
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace('<!--seo-head-->', () => head(part, v))
    .replace('<!--seo-about-->', () => PAGES[lang].about.trim())
    .replace(/<!--langs:(\w+)-->/, (_, cls: string) => switchTo(cls))
    .replace(/\[\[(\w+)\]\]/g, (whole, name: string) => (name in slots ? esc(slots[name]) : whole));
  // A language page sits one folder further down, so its relative links climb one more.
  return v === 'root' ? out : out.replace(/\b(src|href)="(\.\.?)\//g, (_, attr, dots) => `${attr}="${dots === '.' ? '..' : '../..'}/`);
}

function sitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = (Object.keys(PARTS) as Part[])
    .flatMap((part) => {
      const links =
        LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlOf(part, l)}" />`).join('\n') +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf(part, 'root')}" />`;
      return (['root', ...LANGS] as Variant[]).map(
        (v) => `  <url>\n    <loc>${urlOf(part, v)}</loc>\n    <lastmod>${today}</lastmod>\n${links}\n  </url>`,
      );
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls}\n</urlset>\n`
  );
}

const LANG_PAGE = /^\/(durak\/)?(ru|en|fr)\/(?:index\.html)?(?:\?.*)?$/;

function pages(): Plugin {
  return {
    name: 'synarteum-pages',
    enforce: 'post',
    // While developing there is no build: the language addresses are served from the same two
    // pages, filled in as they go out.
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
        const part: Part = ctx.filename.replace(/\\/g, '/').endsWith('/durak/index.html') ? 'durak' : 'landing';
        const m = (ctx.originalUrl ?? '').match(LANG_PAGE);
        return localize(html, part, m ? (m[2] as PageLang) : 'root');
      },
    },
    generateBundle(_options, bundle) {
      for (const part of Object.keys(PARTS) as Part[]) {
        const file = PARTS[part].file;
        const page = bundle[file];
        if (!page || page.type !== 'asset') continue;
        const html = String(page.source);
        page.source = localize(html, part, 'root');
        for (const lang of LANGS) {
          const fileName = file.replace('index.html', `${lang}/index.html`);
          this.emitFile({ type: 'asset', fileName, source: localize(html, part, lang) });
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
  build: { rollupOptions: { input: { index: at('./index.html'), durak: at('./durak/index.html') } } },
});
