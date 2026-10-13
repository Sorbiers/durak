import '@fontsource-variable/unbounded';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/golos-text';
import './style.css';
import { LANDING, type PageLang, otherLangs } from '../seo';
import { PAGE_LANG, browserLang } from '../ui/root';
import { type Emblem, startEmblem, startField } from './neurons';

// The exhibits: a spade for the card game, an eye for the gallery (it follows the visitor),
// a steaming cup for the café.
const EMBLEMS: Record<string, Emblem> = {
  spade: {
    paths: [
      'M50 6C80 32 92 46 92 60c0 13-10 20-20 20-8 0-14-4-18-10 1 10 4 18 10 24H36c6-6 9-14 10-24-4 6-10 10-18 10C18 80 8 73 8 60 8 46 20 32 50 6Z',
    ],
  },
  eye: {
    paths: [
      'M5 50C24 23 76 23 95 50C76 77 24 77 5 50Z',
      'M50 33a17 17 0 1 0 .01 0Z',
      'M50 43a7 7 0 1 0 .01 0Z',
    ],
    gaze: [1, 2],
  },
  cup: {
    paths: [
      'M20 46H72V62C72 78 60 88 46 88C32 88 20 78 20 62Z',
      'M72 52C88 52 88 72 72 72',
      'M12 94H80',
      'M34 37C30 31 38 27 34 19',
      'M46 37C42 29 50 23 46 12',
      'M58 37C54 31 62 27 58 19',
    ],
  },
};

/** Puts the page into a language. The language pages are built in theirs already. */
function speak(lang: PageLang): void {
  const text = LANDING[lang];
  document.documentElement.lang = lang;
  document.title = text.title;
  for (const el of document.querySelectorAll<HTMLElement>('[data-t]')) {
    el.textContent = text[el.dataset.t!] ?? el.textContent;
  }
  document.querySelector('#langs')!.innerHTML = otherLangs(lang)
    .map((l) => `<a class="lang" href="./${l}/" hreflang="${l}">${l.toUpperCase()}</a>`)
    .join('');
}

document.documentElement.classList.add('js');

// The root address is built in English and speaks the visitor's language if it can.
if (!PAGE_LANG && browserLang() !== 'en') speak(browserLang());

const rgb = (el: Element, name: string): string => getComputedStyle(el).getPropertyValue(name).trim();
const root = document.documentElement;
startField(document.querySelector<HTMLCanvasElement>('#field')!, [
  rgb(root, '--mint'),
  rgb(root, '--rose'),
  rgb(root, '--amber'),
]);

const halls = [...document.querySelectorAll<HTMLElement>('.hall')];
halls.forEach((hall, index) => {
  const emblem = EMBLEMS[hall.dataset.emblem!];
  const canvas = hall.querySelector('canvas')!;
  const count = startEmblem(canvas, emblem, rgb(hall, '--tone'), 11 + index * 17);
  hall.querySelector('.cap b')!.textContent = String(count);
});

// Each hall wakes when it is walked into.
const waker = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('seen');
      waker.unobserve(entry.target);
    }
  },
  { threshold: 0.25 },
);
halls.forEach((hall) => waker.observe(hall));
