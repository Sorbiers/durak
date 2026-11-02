import { Card, DECK_SIZE, rankOf, suitOf } from '../engine/cards';
import { otherLangs } from '../seo';
import { createCard, isRed, suitSvg } from '../ui/cardView';
import { Lang, fill } from '../ui/i18n';
import { portraitUrl, preloadAvatars } from '../ui/portraits';
import { PAGE_LANG, PART_ROOT, ROOT, browserLang } from '../ui/root';
import { prepareVoices, releaseVoices, speak } from '../ui/speech';
import { load, save } from '../ui/store';
import { Line, TEXTS, lineFor } from './i18n';
import { Frame, frame } from './layout';
import { LENORMAND, SUIT_LEADS, Tone, WISH_ANSWERS } from './meanings';
import { Deck, decodeReading, deckFor, encodeReading, lean, meaningOf, newSeed, outcome } from './reading';
import { FORTUNE_PAGES } from './seo';
import { SPREADS, SYSTEMS, Spread, SystemId, spreadById } from './spreads';
import { TELLERS, TellerMood, tellerById, tellerPicture } from './tellers';

// The fortune-telling page. A reading goes: choose a fortune-teller and a spread, she shuffles,
// you cut the deck, pick cards from a face-down fan, and turn them over one by one as she reads.

type Phase = 'choose' | 'shuffle' | 'cut' | 'pick' | 'reveal' | 'done';

interface Settings {
  lang: Lang;
  teller: string; // the fortune-teller's id
  system: SystemId;
  chosen: Record<SystemId, string>; // the spread last chosen in each system
  voice: boolean; // what she says is also read aloud
}

const DEFAULTS: Settings = {
  lang: browserLang(),
  teller: TELLERS[0].id,
  system: 'russian',
  chosen: { russian: 'three', lenormand: 'line3' },
  voice: false,
};

/** The readings made today, so that a question is not asked twice in a day. */
interface Today {
  date: string;
  links: Record<string, string>; // by spread: the reading, as a shared link writes it
}

const SWAP_MS = 200; // how long one picture of the fortune-teller takes to turn into the next
const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const dateToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function startFortune(): void {
  const stage = $('stage');
  const cardsLayer = $('cards');
  const labelsLayer = $('labels');
  const face = $<HTMLImageElement>('reader-face');
  const plate = $('reader-plate');
  const bubble = plate.querySelector<HTMLElement>('.bubble')!;
  const chooser = $('chooser');
  const actions = $('actions');
  const statusEl = $('status');
  const buttonsEl = $('buttons');
  const readingEl = $('reading');
  const aboutDialog = $<HTMLDialogElement>('about');

  let settings = load('fortune.settings', DEFAULTS);
  settings = { ...settings, chosen: { ...DEFAULTS.chosen, ...settings.chosen } };
  if (!SYSTEMS.includes(settings.system)) settings = { ...settings, system: DEFAULTS.system };
  // A page in one language is in that language, whatever was chosen before.
  if (PAGE_LANG) settings = { ...settings, lang: PAGE_LANG };
  let t = TEXTS[settings.lang];
  let teller = tellerById(settings.teller);
  let aboutLang: Lang | undefined;

  let phase: Phase = 'choose';
  let spread = chosenSpread();
  let seed = 0;
  let deck: Deck = deckFor(seed);
  let picks: number[] = []; // the places in the fan of the cards picked, in the spread's order
  let turned: boolean[] = [];
  let shuffleStep = 0; // while shuffling: on odd steps the deck is split in two
  let cutStep = 0; // 1: the top of the deck lifted aside; 2: put underneath
  let question = '';
  let shared = false; // the reading came from a link
  let answered = false; // the chosen spread was already read today, and the chooser says so
  let run = 0; // bumped on every new reading, so that timers of an old one do nothing
  let shareNote = ''; // after "Copy link": that it was copied, or the link itself to copy by hand
  let written = new Set<number>(); // places whose card is already written out, so only new ones rise in
  let f: Frame;

  // Her face: a passing mood, or the one that goes with what is happening.
  let mood: TellerMood = 'neutral';
  let moodUntil = 0;
  let finalMood: TellerMood = 'neutral';
  let shownMood: TellerMood | null = null;
  let shownPicture: Partial<Record<TellerMood, string>> = {};

  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < DECK_SIZE; c++) {
    const el = createCard(c);
    const emblem = document.createElement('span');
    emblem.className = 'emblem';
    el.querySelector('.card-face')!.appendChild(emblem);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onCardClick(c);
    });
    cardEls.push(el);
    cardsLayer.appendChild(el);
  }

  function chosenSpread(): Spread {
    const s = spreadById(settings.chosen[settings.system]);
    return s && s.system === settings.system ? s : SPREADS.find((x) => x.system === settings.system)!;
  }

  const fanPlace = (c: Card): number => deck.order.indexOf(c);
  const slotOf = (c: Card): number => picks.findIndex((p) => deck.order[p] === c);
  const pickedCards = (): Card[] => picks.map((p) => deck.order[p]);

  // ---------------------------------------------------------------- the reading

  /** Starts a reading of the chosen spread: shuffle, then wait for the cut. */
  async function begin(): Promise<void> {
    const id = ++run;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    shared = false;
    answered = false;
    shareNote = '';
    seed = newSeed();
    deck = deckFor(seed);
    picks = [];
    turned = [];
    cutStep = 0;
    shuffleStep = 0;
    phase = 'shuffle';
    setMood('shuffle', Infinity);
    sayLine('shuffle');
    render();
    const steps = reducedMotion() ? 2 : 6;
    for (let s = 1; s <= steps; s++) {
      await sleep(250);
      if (id !== run) return;
      shuffleStep = s;
      render();
    }
    await sleep(300);
    if (id !== run) return;
    phase = 'cut';
    setMood('neutral', 0);
    sayLine('cut');
    render();
  }

  async function cut(): Promise<void> {
    const id = run;
    cutStep = 1;
    render();
    await sleep(380);
    if (id !== run) return;
    cutStep = 2;
    render();
    await sleep(450);
    if (id !== run) return;
    phase = 'pick';
    sayLine('pick');
    render();
  }

  function pick(c: Card): void {
    picks.push(fanPlace(c));
    turned.push(false);
    if (picks.length === spread.slots.length) {
      phase = 'reveal';
      sayLine('reveal');
    }
    render();
  }

  function turn(k: number, quiet = false): void {
    turned[k] = true;
    const card = deck.order[picks[k]];
    const m = meaningOf(spread.system, card);
    if (!quiet || m.strong) react(m.tone, m.strong ?? false);
    render();
    if (turned.every(Boolean)) {
      const id = run;
      setTimeout(() => {
        if (id === run) finish();
      }, 1100);
    }
  }

  async function turnAll(): Promise<void> {
    const id = run;
    for (let k = 0; k < turned.length; k++) {
      if (turned[k]) continue;
      turn(k, true);
      await sleep(420);
      if (id !== run) return;
    }
  }

  /** The fortune-teller's response to a card as it is turned. */
  function react(tone: Tone, strong: boolean): void {
    const [face, line]: [TellerMood, Line] = strong
      ? tone > 0
        ? ['happy', 'best']
        : ['surprised', 'worst']
      : tone > 0
        ? ['pleased', 'good']
        : tone < 0
          ? ['worried', 'bad']
          : ['thinking', 'neutral'];
    setMood(face, 2600);
    if (strong || tone !== 0 || Math.random() < 0.5) sayLine(line);
  }

  /** All the cards are face up: the reading is complete. */
  function finish(): void {
    phase = 'done';
    const leaning = lean(spread, pickedCards());
    finalMood = leaning > 0 ? 'happy' : leaning < 0 ? 'sad' : 'pleased';
    setMood(finalMood, 0);
    sayLine(leaning > 0 ? 'bright' : leaning < 0 ? 'dark' : 'mixed');
    if (!shared) {
      const today = load<Today>('fortune.today', { date: '', links: {} });
      const links = today.date === dateToday() ? today.links : {};
      save('fortune.today', { date: dateToday(), links: { ...links, [spread.id]: encodeReading(spread, seed, picks) } });
      // Lets the server count readings: asking for an empty file is enough, as its log keeps the address.
      void fetch(`${ROOT}game.txt?f=${spread.id}`, { cache: 'no-store', keepalive: true }).catch(() => undefined);
    }
    render();
    if (!matchMedia('(min-width: 900px)').matches) {
      readingEl.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /** Lays out a finished reading at once, face up: one from a link, or today's of a spread. */
  function show(text: string, fromLink: boolean): boolean {
    const found = decodeReading(text);
    if (!found) return false;
    run++;
    spread = found.spread;
    settings = { ...settings, system: spread.system, chosen: { ...settings.chosen, [spread.system]: spread.id } };
    seed = found.seed;
    deck = deckFor(seed);
    picks = found.picks;
    turned = picks.map(() => true);
    cutStep = 2;
    shared = fromLink;
    answered = false;
    shareNote = '';
    phase = 'done';
    const leaning = lean(spread, pickedCards());
    finalMood = leaning > 0 ? 'happy' : leaning < 0 ? 'sad' : 'pleased';
    setMood(finalMood, 0);
    render();
    return true;
  }

  /** Back to the choice of spread, the cards gathered into the deck. */
  function choose(): void {
    run++;
    phase = 'choose';
    picks = [];
    turned = [];
    cutStep = 0;
    shuffleStep = 0;
    shared = false;
    answered = false;
    shareNote = '';
    finalMood = 'neutral';
    setMood('neutral', 0);
    buildChooser();
    render();
  }

  /** "Shuffle" in the chooser: unless this spread was already read today. */
  function requestBegin(): void {
    const input = chooser.querySelector<HTMLInputElement>('#question');
    question = input?.value.trim() ?? '';
    const today = load<Today>('fortune.today', { date: '', links: {} });
    if (!answered && today.date === dateToday() && today.links[spread.id]) {
      answered = true;
      setMood('worried', 2600);
      sayLine('answered');
      buildChooser();
      return;
    }
    void begin();
  }

  function onCardClick(c: Card): void {
    if (phase === 'cut' && cutStep === 0) {
      void cut();
    } else if (phase === 'pick' && slotOf(c) < 0) {
      pick(c);
    } else if (phase === 'reveal') {
      const k = slotOf(c);
      if (k >= 0 && !turned[k]) turn(k);
    } else if (phase === 'done') {
      const k = slotOf(c);
      const entry = readingEl.querySelector<HTMLElement>(`li[data-slot="${k}"]`);
      if (!entry) return;
      for (const li of readingEl.querySelectorAll('li.lit')) li.classList.remove('lit');
      entry.classList.add('lit');
      entry.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  // ------------------------------------------------------- the fortune-teller

  /** Another fortune-teller takes her seat, and greets whoever is at the table. */
  function seat(id: string): void {
    if (id === teller.id) return;
    teller = tellerById(id);
    settings = { ...settings, teller: teller.id };
    save('fortune.settings', settings);
    shownMood = null;
    shownPicture = {};
    preloadAvatars(teller);
    if (settings.voice) prepareVoices([teller], settings.lang);
    buildChooser();
    render();
    sayLine('greet');
  }

  function setMood(m: TellerMood, ms: number): void {
    mood = m;
    moodUntil = performance.now() + ms;
    renderFace();
    if (Number.isFinite(ms) && ms > 0) setTimeout(renderFace, ms + 50);
  }

  const moodNow = (): TellerMood => {
    if (moodUntil > performance.now()) return mood;
    if (phase === 'shuffle') return 'shuffle';
    if (phase === 'pick' || phase === 'reveal') return 'thinking';
    if (phase === 'done') return finalMood;
    return 'neutral';
  };

  function renderFace(): void {
    const m = moodNow();
    if (m === shownMood) return;
    shownMood = m;
    const src = tellerPicture(teller, m, shownPicture[m]);
    shownPicture[m] = src;
    // The old picture is left on top to fade away, as the portraits in the game do.
    if (face.hasAttribute('src') && !reducedMotion()) {
      const old = face.cloneNode() as HTMLImageElement;
      old.removeAttribute('id');
      old.classList.add('fading');
      face.after(old);
      const fade = old.animate({ opacity: 0 }, { duration: SWAP_MS, easing: 'ease-in-out', fill: 'forwards' });
      fade.onfinish = () => old.remove();
    }
    face.src = src;
  }

  /** Shows what she says for long enough to read it, and says it aloud if asked to. */
  function sayLine(line: Line): void {
    const text = lineFor(teller.id, line, settings.lang);
    bubble.textContent = text;
    bubble.style.setProperty('--say', `${1600 + text.length * 50}ms`);
    bubble.classList.remove('show');
    void bubble.offsetWidth; // restart the animation
    bubble.classList.add('show');
    if (settings.voice) speak(text, teller, settings.lang);
  }

  // ---------------------------------------------------------------- rendering

  function render(): void {
    const rect = stage.getBoundingClientRect();
    f = frame(rect.width, rect.height, spread, phase === 'pick');
    stage.style.setProperty('--cw', `${f.cw}px`);
    stage.classList.toggle('lenormand', spread.system === 'lenormand');
    const inDeck = phase === 'choose' || phase === 'shuffle' || phase === 'cut';
    // The deck before the cut, top card first; after it, the order the fan lays out.
    const pile = inDeck && cutStep < 2 && phase !== 'choose' ? deck.before : deck.order;
    const deckW = f.cw * f.deck.scale;
    for (let c = 0; c < DECK_SIZE; c++) {
      const el = cardEls[c];
      const k = slotOf(c);
      let x = f.deck.x;
      let y = f.deck.y;
      let rot = 0;
      let scale = f.deck.scale;
      let z = 50;
      let up = false;
      if (inDeck) {
        // A neat stack, the top card highest, each card a hair above the one beneath.
        const i = pile.indexOf(c);
        const lift = (DECK_SIZE - 1 - i) * 0.3;
        x -= lift * 0.5;
        y -= lift;
        z = 200 - i;
        if (phase === 'shuffle' && shuffleStep % 2 === 1) {
          const side = i % 2 === 0 ? -1 : 1;
          x += side * deckW * 0.62;
          rot = side * 5;
        }
        if (phase === 'cut' && cutStep === 1 && i < deck.cut) {
          x += deckW * 1.15;
          y -= 8;
        }
      } else if (k >= 0) {
        x = f.slots[k].x;
        y = f.slots[k].y;
        scale = 1;
        z = 300 + k;
        up = turned[k];
      } else if (phase === 'pick') {
        const i = fanPlace(c);
        ({ x, y, rot } = f.fan[i]);
        scale = f.fanScale;
        z = 100 + i;
      }
      el.style.transform = `translate(${x - f.cw / 2}px, ${y - f.ch / 2}px) rotate(${rot}deg) scale(${scale})`;
      el.style.zIndex = String(z);
      el.classList.toggle('up', up);
      // The deck stays out of sight behind the choice of spread, and the cards not picked are
      // put away once the spread is laid out.
      el.classList.toggle('gone', phase === 'choose' || (!inDeck && k < 0 && phase !== 'pick'));
      el.classList.toggle('cuttable', phase === 'cut' && cutStep === 0);
      el.classList.toggle('pickable', phase === 'pick' && k < 0);
      el.classList.toggle('turnable', phase === 'reveal' && k >= 0 && !turned[k]);
      el.classList.toggle('core', k >= 0 && k === spread.core && up);
      for (const r of el.querySelectorAll('.rank')) r.textContent = t.ranks[rankOf(c)];
      const emblem = LENORMAND[c];
      el.querySelector('.emblem')!.textContent = `${emblem.n} · ${emblem.name[settings.lang]}`;
      if (up) el.setAttribute('aria-label', cardTitle(c));
      else el.removeAttribute('aria-label');
      const clickable = (phase === 'cut' && cutStep === 0) || (phase === 'pick' && k < 0) || (phase === 'reveal' && k >= 0 && !up);
      if (clickable) el.setAttribute('role', 'button');
      else el.removeAttribute('role');
    }
    renderTeller();
    renderLabels();
    renderActions();
    renderReading();
    renderBar();
    chooser.hidden = phase !== 'choose';
    chooser.style.setProperty('--top', `${f.area.top - 4}px`);
  }

  function renderTeller(): void {
    const p = f.portrait;
    Object.assign(face.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.size}px`, height: `${p.size}px` });
    for (const old of document.querySelectorAll<HTMLElement>('#seats .avatar.fading')) {
      Object.assign(old.style, { left: face.style.left, top: face.style.top, width: face.style.width, height: face.style.height });
    }
    plate.style.left = `${p.x + p.size / 2}px`;
    plate.style.top = `${p.y + p.size - 14}px`;
    plate.querySelector('.name')!.textContent = teller.name[settings.lang];
    renderFace();
  }

  /** What each place in the spread stands for, and outlines where cards are still to go. */
  function renderLabels(): void {
    if (phase === 'choose' || phase === 'shuffle' || phase === 'cut') {
      labelsLayer.innerHTML = '';
      return;
    }
    const parts: string[] = [];
    if (phase === 'pick') {
      f.slots.forEach((s, k) => {
        if (k < picks.length) return;
        parts.push(
          `<div class="slot-outline" style="left:${s.x - f.cw / 2}px;top:${s.y - f.ch / 2}px;width:${f.cw}px;height:${f.ch}px"></div>`,
        );
      });
    }
    spread.places?.forEach((place, k) => {
      const p = f.placeLabels[k];
      const core = k === spread.core ? ' core' : '';
      parts.push(`<div class="place-label${core}" style="left:${p.x}px;top:${p.y}px">${t.places[place]}</div>`);
    });
    spread.rows?.forEach((place, r) => {
      const p = f.rowLabels[r];
      parts.push(`<div class="row-label" style="left:${p.x}px;top:${p.y}px">${t.places[place]}</div>`);
    });
    spread.cols?.forEach((place, c) => {
      const p = f.colLabels[c];
      parts.push(`<div class="col-label" style="left:${p.x}px;top:${p.y}px">${t.places[place]}</div>`);
    });
    labelsLayer.innerHTML = parts.join('');
  }

  function renderActions(): void {
    actions.style.top = `${f.area.bottom + 29}px`;
    const total = spread.slots.length;
    let status = '';
    if (phase === 'shuffle') status = fill(t.shuffling, { name: teller.name[settings.lang] });
    else if (phase === 'cut') status = t.cut;
    else if (phase === 'pick') status = total === 1 ? t.pickOne : fill(t.pick, { left: total - picks.length, total });
    else if (phase === 'reveal') status = t.reveal;
    else if (phase === 'done' && shared) status = t.shared;
    statusEl.textContent = status;
    buttonsEl.innerHTML = '';
    if (phase === 'reveal' && turned.filter((x) => !x).length > 1) {
      const b = document.createElement('button');
      b.className = 'primary';
      b.textContent = t.turnAll;
      b.addEventListener('click', () => void turnAll());
      buttonsEl.appendChild(b);
    }
  }

  const cardTitle = (c: Card): string => {
    const plain = t.cardName(rankOf(c), suitOf(c));
    return spread.system === 'lenormand' ? `${LENORMAND[c].name[settings.lang]} (${plain})` : plain;
  };

  /** What a place stands for, in the reading's text. */
  function placeName(k: number): string {
    const slot = spread.slots[k];
    let name = '';
    if (spread.places) name = t.places[spread.places[k]];
    else if (spread.rows) name = t.places[spread.rows[slot.y - Math.min(...spread.slots.map((s) => s.y))]];
    else if (spread.cols) name = t.places[spread.cols[slot.x - Math.min(...spread.slots.map((s) => s.x))]];
    if (k === spread.core && !spread.places) name += ` · ${t.core}`;
    return name;
  }

  function verdictHtml(): string {
    const o = outcome(spread, pickedCards());
    if (!o) return '';
    let head = '';
    let text = '';
    switch (o.kind) {
      case 'yesno':
        head = t.yesno[o.reds];
        text = fill(t.reds, { n: o.reds });
        break;
      case 'wish':
        text = WISH_ANSWERS[settings.lang][o.suit];
        break;
      case 'suits':
        text = o.lead === null ? t.balanced : SUIT_LEADS[settings.lang][o.lead];
        break;
      case 'tones':
        text = o.sum > 0 ? t.bright : o.sum < 0 ? t.dark : t.even;
        break;
    }
    return `<div class="verdict">${head ? `<b>${head}</b>` : ''}<span>${text}</span></div>`;
  }

  /** The reading, written out: each card as it is turned, then what they add up to. */
  function renderReading(): void {
    const visible = (phase === 'reveal' || phase === 'done') && turned.some(Boolean);
    readingEl.hidden = !visible;
    document.body.classList.toggle('reading-open', visible);
    if (!visible) {
      readingEl.innerHTML = '';
      written = new Set();
      return;
    }
    const entries = picks
      .map((p, k) => {
        if (!turned[k]) return '';
        const classes = [k === spread.core ? 'core' : '', written.has(k) ? '' : 'new'].filter(Boolean).join(' ');
        written.add(k);
        const c = deck.order[p];
        const m = meaningOf(spread.system, c);
        const [key, sentence] = m.text[settings.lang];
        const red = isRed(suitOf(c)) ? 'red' : 'black';
        const mini = `<span class="mini ${red}">${t.ranks[rankOf(c)]}${suitSvg(suitOf(c))}</span>`;
        const emblem = spread.system === 'lenormand' ? `${LENORMAND[c].n} · ${LENORMAND[c].name[settings.lang]}` : '';
        const name = emblem || t.cardName(rankOf(c), suitOf(c));
        const where = placeName(k);
        return (
          `<li data-slot="${k}"${classes ? ` class="${classes}"` : ''}>` +
          (where ? `<div class="pos">${where}</div>` : '') +
          `<div class="name">${mini}<span>${name}</span></div>` +
          `<p><b class="key">${key}.</b> ${sentence}</p></li>`
        );
      })
      .join('');
    const done = phase === 'done';
    const note = shareNote.startsWith('http')
      ? `<input class="share-link" readonly value="${esc(shareNote)}">`
      : shareNote
        ? `<p class="fine">${shareNote}</p>`
        : '';
    readingEl.innerHTML =
      `<h2>${t.spreads[spread.id][0]}</h2>` +
      (shared ? `<p class="fine">${t.shared}</p>` : '') +
      (question && !shared ? `<p class="question">«${esc(question)}»</p>` : '') +
      (done ? verdictHtml() : '') +
      `<ol class="entries">${entries}</ol>` +
      (done
        ? `<div class="buttons"><button class="primary" data-act="again">${t.again}</button>` +
          `<button class="plain" data-act="other">${t.other}</button>` +
          `<button class="plain" data-act="share">${t.share}</button></div>${note}`
        : '');
  }

  function renderBar(): void {
    document.documentElement.lang = settings.lang;
    document.title = FORTUNE_PAGES[settings.lang].title;
    $('brand').textContent = t.title;
    $('meta').textContent = phase === 'choose' ? '' : t.spreads[spread.id][0];
    $('btn-new').textContent = t.newReading;
    $('btn-voice').textContent = settings.voice ? t.voiceOn : t.voiceOff;
    $('btn-about').firstElementChild!.textContent = t.about;
    $('btn-about').setAttribute('aria-label', t.about);
    const durak = $<HTMLAnchorElement>('to-durak');
    durak.textContent = t.durak;
    durak.href = `${ROOT}${settings.lang}/`;
    if (aboutLang !== settings.lang) {
      aboutLang = settings.lang;
      // Real links to the pages in the other languages; an ordinary click switches in place.
      $('langs').innerHTML = otherLangs(settings.lang)
        .map((l) => `<a class="ghost" href="${PART_ROOT}${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
        .join('');
      $('about-body').innerHTML = FORTUNE_PAGES[settings.lang].about;
      $('about-close').textContent = t.close;
    }
  }

  /** The choice of fortune-teller, system and spread, the question, and the button that starts it all. */
  function buildChooser(): void {
    const kept = chooser.querySelector<HTMLInputElement>('#question')?.value ?? question;
    const tellers = TELLERS.map(
      (x) =>
        `<button type="button" class="teller${x.id === teller.id ? ' on' : ''}" data-teller="${x.id}" ` +
        `aria-pressed="${x.id === teller.id}"><img src="${portraitUrl(x)}" alt="" draggable="false">` +
        `<b>${x.name[settings.lang]}</b><small>${x.tag[settings.lang]}</small></button>`,
    ).join('');
    const systems = SYSTEMS.map(
      (s) =>
        `<label><input type="radio" name="system" value="${s}"${s === settings.system ? ' checked' : ''}>` +
        `<span>${t.systems[s][0]}</span></label>`,
    ).join('');
    const tiles = SPREADS.filter((s) => s.system === settings.system)
      .map(
        (s) =>
          `<button type="button" class="spread${s.id === spread.id ? ' on' : ''}" data-id="${s.id}">` +
          `<b>${t.spreads[s.id][0]}</b><small>${t.spreads[s.id][1]}</small><em>${s.slots.length}</em></button>`,
      )
      .join('');
    chooser.innerHTML =
      `<div class="tellers" role="group" aria-label="${t.teller}">${tellers}</div>` +
      `<div class="seg systems">${systems}</div>` +
      `<p class="fine">${t.systems[settings.system][1]}</p>` +
      `<div class="spreads">${tiles}</div>` +
      `<input id="question" type="text" maxlength="140" autocomplete="off" placeholder="${esc(t.question)}">` +
      (answered
        ? `<div class="notice"><span>${t.answered}</span>` +
          `<button type="button" class="plain" data-act="show">${t.showIt}</button>` +
          `<button type="button" class="plain" data-act="anyway">${t.anyway}</button></div>`
        : '') +
      `<div class="buttons"><button type="button" class="primary" data-act="begin">${t.begin}</button></div>`;
    chooser.querySelector<HTMLInputElement>('#question')!.value = kept;
  }

  chooser.addEventListener('change', (e) => {
    const radio = (e.target as Element).closest<HTMLInputElement>('input[name=system]');
    if (!radio) return;
    settings = { ...settings, system: radio.value as SystemId };
    save('fortune.settings', settings);
    spread = chosenSpread();
    answered = false;
    buildChooser();
    render();
  });
  chooser.addEventListener('click', (e) => {
    const target = e.target as Element;
    const chosen = target.closest<HTMLElement>('[data-teller]');
    if (chosen) {
      seat(chosen.dataset.teller!);
      return;
    }
    const tile = target.closest<HTMLElement>('.spread');
    if (tile) {
      const s = spreadById(tile.dataset.id!);
      if (!s) return;
      spread = s;
      settings = { ...settings, chosen: { ...settings.chosen, [s.system]: s.id } };
      save('fortune.settings', settings);
      answered = false;
      buildChooser();
      render();
      return;
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'begin') requestBegin();
    else if (act === 'anyway') void begin();
    else if (act === 'show') {
      const today = load<Today>('fortune.today', { date: '', links: {} });
      const link = today.date === dateToday() ? today.links[spread.id] : undefined;
      if (link) show(link, false);
    }
  });
  chooser.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as Element).id === 'question') {
      e.preventDefault();
      requestBegin();
    }
  });

  readingEl.addEventListener('click', async (e) => {
    const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'again') void begin();
    else if (act === 'other') choose();
    else if (act === 'share') {
      const url = `${location.origin}${location.pathname}#r=${encodeReading(spread, seed, picks)}`;
      const id = run;
      try {
        await navigator.clipboard.writeText(url);
        shareNote = t.copied;
        setTimeout(() => {
          if (id !== run || shareNote !== t.copied) return;
          shareNote = '';
          renderReading();
        }, 2500);
      } catch {
        // Copying is not allowed here: the link is shown to copy by hand, and is in the address bar.
        history.replaceState(null, '', url);
        shareNote = url;
      }
      renderReading();
      readingEl.querySelector<HTMLInputElement>('.share-link')?.select();
    }
  });

  $('btn-new').addEventListener('click', choose);
  $('btn-voice').addEventListener('click', () => {
    settings = { ...settings, voice: !settings.voice };
    save('fortune.settings', settings);
    if (settings.voice) prepareVoices([teller], settings.lang);
    else releaseVoices();
    renderBar();
  });
  $('btn-about').addEventListener('click', () => aboutDialog.showModal());
  $('langs').addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('a[data-lang]');
    if (!link) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // a new tab or window: follow the link
    e.preventDefault();
    settings = { ...settings, lang: link.dataset.lang as Lang };
    t = TEXTS[settings.lang];
    save('fortune.settings', settings);
    // Keep the address in step with the language without reloading and losing the reading.
    try {
      history.replaceState(null, '', `${PART_ROOT}${settings.lang}/${location.hash}`);
    } catch {
      // Not every place a page can be opened from allows this; the switch still works.
    }
    if (settings.voice) prepareVoices([teller], settings.lang);
    if (phase === 'choose') buildChooser();
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if ((e.target as Element).closest('input, button, a')) return; // they handle their own keys
    if (phase === 'cut' && cutStep === 0) {
      e.preventDefault();
      void cut();
      return;
    }
    const primary = (phase === 'choose' ? chooser : phase === 'done' ? readingEl : buttonsEl).querySelector<HTMLButtonElement>(
      '.primary',
    );
    if (primary) {
      e.preventDefault();
      primary.click();
    }
  });
  new ResizeObserver(() => render()).observe(stage);

  preloadAvatars(teller);
  if (settings.voice) prepareVoices([teller], settings.lang);
  buildChooser();
  const link = location.hash.startsWith('#r=') ? location.hash.slice(3) : '';
  if (!link || !show(link, true)) {
    render();
    setTimeout(() => {
      if (phase === 'choose') sayLine('greet');
    }, 700);
  }
}
