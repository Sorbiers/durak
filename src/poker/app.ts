import { cryptoRng } from '../engine/rng';
import { SUIT_SYMBOLS } from '../engine/cards';
import { POKER_PAGES, otherLangs } from '../seo';
import { card52Element } from '../ui/cardDom';
import { CHARACTERS, Character, Mood, avatarUrl, characterById, preloadAvatars } from '../ui/characters';
import { Lang, fill } from '../ui/i18n';
import { REMARK_CHANCE, Remark, remark } from '../ui/phrases';
import { PAGE_LANG, ROOT, browserLang } from '../ui/root';
import { audition, prepareVoices, releaseVoices, speak, stopSpeaking } from '../ui/speech';
import { POKER_SKILLS, PokerDecision, observe } from './ai';
import { PCard, bestFive, categoryOf, pRank, pSuit } from './cards';
import { PokerClient } from './client';
import {
  HandState,
  PAction,
  START_STACK,
  act,
  blindFor,
  cloneHand,
  newHand,
  pot,
  raiseRange,
  toCall,
} from './engine';
import { PSTRINGS, PokerStrings } from './i18n';
import { PokerGeometry, computeLayout } from './layout';

const HUMAN = 0;

type AvatarMode = 'static' | 'context';
type Rating = 1 | 2 | 3 | 4 | 5;

interface Settings {
  opponents: string[]; // one to five, clockwise from the player's left
  ratings: Record<string, Rating>;
  pace: number; // how long a computer player's move stays before the next, in ms
  portraits: boolean;
  avatars: AvatarMode;
  phrases: boolean;
  speech: boolean;
  hints: boolean;
  equity: boolean;
  openCards: boolean;
  training: boolean;
  lang: Lang;
}

interface Tally {
  games: number;
  wins: number;
}

const NO_TALLY: Tally = { games: 0, wins: 0 };

const DEFAULTS: Settings = {
  opponents: ['lev', 'vera', 'gleb', 'tamara'],
  ratings: {},
  pace: 800,
  portraits: true,
  avatars: 'context',
  phrases: true,
  speech: false,
  hints: false,
  equity: false,
  openCards: false,
  training: true,
  lang: browserLang(),
};

function load<T>(key: string, fallback: T, store: () => Storage = () => localStorage): T {
  try {
    const raw = store().getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown, store: () => Storage = () => localStorage): void {
  try {
    store().setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private window); the game works without it.
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function startPoker(): void {
  const stage = $('stage');
  const cardsLayer = $('cards');
  const seatsLayer = $('seats');
  const statusEl = $('status');
  const buttonsEl = $('buttons');
  const resultEl = $('result');
  const settingsDialog = $<HTMLDialogElement>('settings');
  const aboutDialog = $<HTMLDialogElement>('about');
  let aboutLang: Lang | undefined;

  const ai = new PokerClient();
  const analyst = new PokerClient(); // the player's chances and hints, so nobody waits for them
  let settings = load('poker.settings', DEFAULTS);
  const known = settings.opponents.filter((id) => CHARACTERS.some((c) => c.id === id)).slice(0, 5);
  settings = { ...settings, opponents: known.length > 0 ? known : DEFAULTS.opponents };
  if (PAGE_LANG) settings = { ...settings, lang: PAGE_LANG };
  const session = (): Storage => sessionStorage;
  let tallies = load<Record<string, Tally>>('poker.tally', {}, session);
  let t: PokerStrings = PSTRINGS[settings.lang];

  let hand!: HandState;
  let stacks: number[] = [];
  let handNo = 0;
  let button = 0;
  let places: number[] = []; // the place each seat finished in; 0 while still playing
  let gameId = 0;
  let moveNo = 0;
  let awaitingHuman = false;
  let thinking = -1;
  let notice = '';
  let advice: PokerDecision | null = null;
  let adviceFor = -1; // the move number the advice is for
  let showHint = false;
  let raiseTo = 0;
  let between = false; // a hand is over and the next waits for the player
  let lastAction: string[] = [];
  let highlight: PCard[] = [];
  let geo: PokerGeometry;
  let seatEls: HTMLElement[] = [];
  let avatarEls: (HTMLImageElement | null)[] = [];
  let chipEls: (HTMLElement | null)[] = [];
  let betEls: HTMLElement[] = [];
  let moods: { mood: Mood; until: number }[] = [];
  let lastNudge = 0;

  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < 52; c++) {
    const el = card52Element(c);
    cardEls.push(el);
    cardsLayer.appendChild(el);
  }

  const aid = (name: 'hints' | 'equity' | 'openCards'): boolean => settings.training && settings[name];
  const who = (seat: number): Character => characterById(settings.opponents[seat - 1]);
  const ratingOf = (c: Character): Rating => {
    const chosen = settings.ratings[c.id];
    return chosen >= 1 && chosen <= 5 ? chosen : c.rating;
  };
  const seatName = (seat: number): string => (seat === HUMAN ? t.you : who(seat).name[settings.lang]);
  const cardText = (c: PCard): string => t.ranks13[pRank(c)] + SUIT_SYMBOLS[pSuit(c)];
  const tallyKey = (): string => settings.opponents.map((id) => id + ratingOf(characterById(id))).join('+');
  const busted = (p: number): boolean => places[p] > 0;

  // ---------------------------------------------------------------- tournament

  function newTournament(): void {
    const n = settings.opponents.length + 1;
    stacks = new Array<number>(n).fill(START_STACK);
    places = new Array<number>(n).fill(0);
    handNo = 0;
    button = (cryptoRng() * n) | 0;
    resultEl.hidden = true;
    moods = Array.from({ length: n }, () => ({ mood: 'neutral' as Mood, until: 0 }));
    stopSpeaking();
    const cast = settings.opponents.map(characterById);
    if (settings.speech) prepareVoices(cast, settings.lang);
    if (settings.portraits) cast.forEach(preloadAvatars);
    buildSeats();
    dealHand(true);
  }

  function dealHand(first = false): void {
    hand = newHand(stacks, button, blindFor(handNo), cryptoRng);
    const id = ++gameId;
    moveNo = 0;
    awaitingHuman = false;
    thinking = -1;
    between = false;
    notice = '';
    advice = null;
    adviceFor = -1;
    showHint = false;
    highlight = [];
    analyst.cancel();
    lastAction = hand.stacks.map(() => '');
    render(true);
    setTimeout(() => {
      if (id !== gameId) return;
      render();
      if (first) react(1 + ((Math.random() * settings.opponents.length) | 0), 'greet');
      setTimeout(() => void run(id), 500);
    }, 40);
  }

  async function run(id: number): Promise<void> {
    while (id === gameId && !hand.over) {
      const seat = hand.turn;
      if (seat === HUMAN) {
        awaitingHuman = true;
        const range = raiseRange(hand);
        raiseTo = range ? range.min : 0;
        if (aid('equity') || showHint) void analyse();
        render();
        nudgeLater(id);
        return;
      }
      thinking = seat;
      render();
      const started = performance.now();
      const decision = await ai.request(observe(hand, seat), POKER_SKILLS[ratingOf(who(seat))]);
      if (id !== gameId) return;
      // Nobody is waiting for the others once the player has folded or is all in.
      const hurry = hand.folded[HUMAN] || hand.stacks[HUMAN] === 0;
      const pause = (hurry ? 250 : settings.pace) - (performance.now() - started);
      if (pause > 0) await sleep(pause);
      if (id !== gameId) return;
      thinking = -1;
      await play(decision.action, id);
    }
    if (id === gameId && hand.over) finishHand();
  }

  async function play(a: PAction, _id: number): Promise<void> {
    const seat = hand.turn;
    moveNo++;
    advice = null;
    showHint = false;
    analyst.cancel();
    const before = hand;
    const next = cloneHand(hand);
    act(next, a);
    const allIn = next.stacks[seat] === 0 && before.stacks[seat] > 0 && a.type !== 'fold';
    const amount = next.bets[seat] || before.bets[seat] + (before.stacks[seat] - next.stacks[seat]);
    lastAction[seat] =
      a.type === 'fold'
        ? t.aFold
        : allIn
          ? t.aAllIn
          : a.type === 'check'
            ? t.aCheck
            : a.type === 'call'
              ? t.aCall
              : `${before.currentBet > 0 ? t.aRaise : t.aBet} ${amount}`;
    react(seat, a.type === 'fold' ? 'pFold' : allIn ? 'pAllIn' : a.type === 'check' ? 'pCheck' : a.type === 'call' ? 'pCall' : 'pRaise');
    if (allIn) setMood(seat, 'pleased');
    hand = next;
    if (next.board.length > before.board.length || next.over) {
      // A new street: the bets go to the pot and the words above the players are cleared.
      lastAction = lastAction.map((_, p) => (next.folded[p] ? t.aFold : next.stacks[p] === 0 && next.dealt[p] ? t.aAllIn : ''));
    }
    render();
    await sleep(next.board.length > before.board.length ? 700 : 220);
  }

  function finishHand(): void {
    awaitingHuman = false;
    const total = stacks.reduce((a, b) => a + b, 0);
    const showdown = hand.awards.some((w) => w.score >= 0);
    const lines = hand.awards.map((w) => {
      const line = w.seat === HUMAN ? fill(t.youWin, { n: w.amount }) : fill(t.wins, { name: seatName(w.seat), n: w.amount });
      return showdown ? fill(t.withHand, { line, hand: t.hands[categoryOf(w.score)] }) : fill(t.folded, { line });
    });
    if (showdown) {
      const main = hand.awards.reduce((a, w) => (w.amount > a.amount ? w : a));
      highlight = bestFive([...hand.holes[main.seat], ...hand.board]);
    }
    for (const w of hand.awards) {
      const big = w.amount >= total * 0.25;
      setMood(w.seat, big ? 'happy' : 'pleased');
      react(w.seat, big ? 'pBigWin' : 'pWin');
    }
    notice = lines.join(' ');
    stacks = hand.stacks.slice();
    // Who has lost everything leaves; those who go out in the same hand share the worse place.
    const alive = stacks.filter((c) => c > 0).length;
    const goingOut = stacks.map((c, p) => c === 0 && places[p] === 0);
    goingOut.forEach((out, p) => {
      if (!out) return;
      places[p] = alive + 1;
      if (p !== HUMAN) {
        setMood(p, 'sad', Infinity);
        setTimeout(() => react(p, 'pBust'), 1200);
      }
    });
    between = true;
    render();
    const humanOut = places[HUMAN] > 0;
    if (humanOut || alive === 1) {
      const won = !humanOut;
      if (!won) {
        const left = [...stacks.keys()].filter((p) => p !== HUMAN && stacks[p] > 0);
        if (left.length) setTimeout(() => react(left[(Math.random() * left.length) | 0], 'pYouBust'), 1800);
      }
      const champion = stacks.findIndex((c) => c > 0);
      if (champion > 0 && alive === 1) setTimeout(() => react(champion, 'pChampion', 'happy'), 2400);
      const key = tallyKey();
      const tally = { ...NO_TALLY, ...tallies[key] };
      tally.games++;
      if (won) tally.wins++;
      tallies = { ...tallies, [key]: tally };
      save('poker.tally', tallies, session);
      setTimeout(() => {
        resultEl.innerHTML = `<p></p><small></small><button class="primary"></button>`;
        resultEl.querySelector('p')!.textContent = won ? t.champion : fill(t.busted, { place: places[HUMAN] });
        resultEl.querySelector('small')!.textContent = notice;
        const b = resultEl.querySelector('button')!;
        b.textContent = t.newGame;
        b.addEventListener('click', newTournament);
        resultEl.className = won ? '' : 'lost';
        resultEl.hidden = false;
        render();
      }, 1600);
    }
  }

  function nextHand(): void {
    if (!between || !resultEl.hidden) return;
    handNo++;
    const n = stacks.length;
    do button = (button + 1) % n;
    while (stacks[button] === 0);
    dealHand();
  }

  function nudgeLater(id: number): void {
    const at = moveNo;
    setTimeout(() => {
      const now = performance.now();
      if (id !== gameId || moveNo !== at || !awaitingHuman || now - lastNudge < 180_000) return;
      const waiting = [...stacks.keys()].filter((p) => p !== HUMAN && !busted(p));
      if (!waiting.length) return;
      lastNudge = now;
      react(waiting[(Math.random() * waiting.length) | 0], 'waiting');
    }, 40_000);
  }

  // -------------------------------------------------------------- human input

  function humanPlay(a: PAction): void {
    if (!awaitingHuman) return;
    awaitingHuman = false;
    notice = '';
    const id = gameId;
    void play(a, id).then(() => {
      if (id === gameId) void run(id);
    });
  }

  /** The player's chances and what the strongest computer player would do in their place. */
  async function analyse(): Promise<void> {
    if (adviceFor === moveNo) return;
    adviceFor = moveNo;
    const id = gameId;
    const at = moveNo;
    const obs = observe(hand, HUMAN);
    const d = await analyst.request(obs, POKER_SKILLS[5]);
    if (id !== gameId || at !== moveNo) return;
    advice = d;
    render();
  }

  function moveText(a: PAction): string {
    if (a.type === 'fold') return t.fold;
    if (a.type === 'check') return t.check;
    if (a.type === 'call') return fill(t.call, { n: toCall(hand, HUMAN) });
    return fill(hand.currentBet > 0 ? t.raiseTo : t.bet, { n: a.to });
  }

  // ---------------------------------------------------------------- rendering

  function showBubble(seat: number, text: string): void {
    const bubble = seatEls[seat].querySelector<HTMLElement>('.bubble')!;
    bubble.textContent = text;
    bubble.style.setProperty('--say', `${1400 + text.length * 45}ms`);
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.classList.add('show');
  }

  function setMood(seat: number, mood: Mood, ms = 4000): void {
    if (seat === HUMAN) return;
    moods[seat] = { mood, until: performance.now() + ms };
    renderSeats();
    if (Number.isFinite(ms)) {
      const id = gameId;
      setTimeout(() => {
        if (id === gameId) renderSeats();
      }, ms + 50);
    }
  }

  const moodOf = (seat: number): Mood => {
    if (!settings.portraits || settings.avatars !== 'context') return 'neutral';
    if (thinking === seat) return 'thinking';
    return moods[seat].until > performance.now() ? moods[seat].mood : 'neutral';
  };

  function react(seat: number, what: Remark, mood?: Mood): void {
    if (seat === HUMAN || seat < 0) return;
    if (mood) setMood(seat, mood);
    if (!settings.phrases || Math.random() >= (REMARK_CHANCE[what] ?? 1)) return;
    const text = remark(who(seat).id, what, settings.lang);
    if (!text) return;
    showBubble(seat, text);
    if (settings.speech) speak(text, who(seat), settings.lang);
  }

  function buildSeats(): void {
    seatsLayer.innerHTML = '';
    seatEls = [];
    avatarEls = [];
    chipEls = [];
    betEls = [];
    const n = settings.opponents.length + 1;
    for (let p = 0; p < n; p++) {
      let avatar: HTMLImageElement | null = null;
      let chip: HTMLElement | null = null;
      if (p !== HUMAN) {
        avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.alt = '';
        avatar.draggable = false;
        seatsLayer.appendChild(avatar);
        chip = document.createElement('div');
        chip.className = 'role-chip';
        seatsLayer.appendChild(chip);
      }
      avatarEls.push(avatar);
      chipEls.push(chip);
      const el = document.createElement('div');
      el.className = p === HUMAN ? 'seat me' : 'seat';
      el.innerHTML =
        `<span class="name"></span><span class="count"></span><span class="role"></span><span class="chance"></span>` +
        `<span class="dots"><i></i><i></i><i></i></span><span class="bubble"></span>`;
      seatsLayer.appendChild(el);
      seatEls.push(el);
      const bet = document.createElement('div');
      bet.className = 'bet';
      seatsLayer.appendChild(bet);
      betEls.push(bet);
    }
  }

  function render(instant = false): void {
    const rect = stage.getBoundingClientRect();
    const over = hand.over;
    const showdown = over && hand.awards.some((w) => w.score >= 0);
    const reveal = hand.stacks.map(
      (_, p) => p === HUMAN || aid('openCards') || (showdown && hand.dealt[p] && !hand.folded[p]),
    );
    const large = settings.portraits && rect.height > 560 && rect.width > 900;
    const layout = computeLayout(hand, rect.width, rect.height, {
      human: HUMAN,
      reveal,
      portraits: settings.portraits ? (large ? 'large' : 'normal') : 'off',
      highlight,
    });
    geo = layout.geo;
    stage.style.setProperty('--cw', `${geo.cw}px`);
    stage.classList.toggle('instant', instant);
    stage.classList.toggle('big-portraits', large);
    let drawn = 0;
    for (let c = 0; c < 52; c++) {
      const el = cardEls[c];
      const place = layout.places.get(c)!;
      const p = instant ? { ...place, x: geo.deck.x, y: geo.deck.y, rot: 0, scale: 0.8, up: false } : place;
      const fresh = !instant && p.where !== 'deck' && el.dataset.where === 'deck';
      const delay = fresh ? drawn++ * 60 : 0;
      if (!instant) el.dataset.where = p.where;
      else el.dataset.where = 'deck';
      el.style.setProperty('--wait', `${delay}ms`);
      el.style.transform = `translate(${p.x - geo.cw / 2}px, ${p.y - geo.ch / 2}px) rotate(${p.rot}deg) scale(${p.scale})`;
      el.style.zIndex = String(p.z);
      el.classList.toggle('up', p.up);
      el.classList.toggle('hinted', highlight.includes(c) && p.where !== 'deck');
      for (const r of el.querySelectorAll('.rank')) r.textContent = t.ranks13[pRank(c)];
      if (p.up) el.setAttribute('aria-label', cardText(c));
      else el.removeAttribute('aria-label');
    }
    if (instant) void stage.offsetWidth;
    renderSeats();
    renderTable();
    renderActions();
    renderBar();
  }

  function renderSeats(): void {
    const over = hand.over;
    for (let p = 0; p < seatEls.length; p++) {
      const el = seatEls[p];
      const at = geo.seats[p];
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
      const out = busted(p) && hand.stacks[p] === 0;
      const avatar = avatarEls[p];
      const spot = geo.avatars[p];
      if (avatar) {
        avatar.hidden = !spot;
        if (spot) {
          avatar.style.left = `${spot.x - spot.size / 2}px`;
          avatar.style.top = `${spot.y - spot.size / 2}px`;
          avatar.style.width = avatar.style.height = `${spot.size}px`;
          const src = avatarUrl(who(p), moodOf(p));
          if (avatar.getAttribute('src') !== src) avatar.src = src;
          avatar.classList.toggle('active', !over && hand.turn === p);
          avatar.classList.toggle('out', out || hand.folded[p]);
        }
      }
      el.classList.toggle('active', !over && hand.turn === p);
      el.classList.toggle('thinking', thinking === p);
      el.classList.toggle('out', out || hand.folded[p]);
      el.querySelector('.name')!.textContent = seatName(p);
      el.querySelector('.count')!.textContent = out ? '' : String(hand.stacks[p]);
      const role = el.querySelector<HTMLElement>('.role')!;
      role.textContent = out ? (p !== HUMAN && who(p).female ? t.outShe : t.out) : p === HUMAN ? lastAction[p] : '';
      // The player's chances, when asked for: worked out for each of their turns.
      const chance = el.querySelector<HTMLElement>('.chance')!;
      chance.textContent = p === HUMAN && aid('equity') && advice && !hand.folded[HUMAN] ? fill(t.chance, { pct: Math.round(advice.equity * 100) }) : '';
      chance.title = t.equityTitle;
      chance.classList.toggle('stale', !awaitingHuman);
      const chip = chipEls[p];
      if (chip && spot) {
        chip.textContent = lastAction[p];
        chip.className = `role-chip${lastAction[p] === t.aFold ? '' : lastAction[p] ? ' attack' : ''}`;
        chip.style.left = `${spot.x}px`;
        chip.style.top = `${spot.y - spot.size / 2 - 12}px`;
      } else if (chip) {
        chip.textContent = lastAction[p];
        chip.className = `role-chip${lastAction[p] ? ' attack' : ''}`;
        chip.style.left = `${at.x}px`;
        chip.style.top = `${at.y - 18}px`;
      }
      const bet = betEls[p];
      const amount = hand.bets[p];
      bet.textContent = amount > 0 && !over ? String(amount) : '';
      bet.style.left = `${geo.bets[p].x}px`;
      bet.style.top = `${geo.bets[p].y}px`;
    }
  }

  function renderTable(): void {
    const potEl = $('pot');
    const total = pot(hand);
    potEl.textContent = total > 0 && !hand.over ? fill(t.potLine, { n: total }) : '';
    potEl.style.left = `${geo.pot.x}px`;
    potEl.style.top = `${geo.pot.y}px`;
    const dealerEl = $('dealer');
    dealerEl.textContent = t.dealerChip;
    dealerEl.style.left = `${geo.dealer[hand.button].x}px`;
    dealerEl.style.top = `${geo.dealer[hand.button].y}px`;
  }

  function renderActions(): void {
    const actions = $('actions');
    actions.style.top = `${geo.actionY}px`;
    buttonsEl.innerHTML = '';
    const button = (label: string, cls: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = cls;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      buttonsEl.appendChild(b);
      return b;
    };
    let status = '';
    if (between) {
      if (resultEl.hidden && places[HUMAN] === 0 && stacks.filter((c) => c > 0).length > 1) {
        button(t.nextHand, 'primary', nextHand);
      }
    } else if (thinking >= 0) status = fill(t.thinking, { name: seatName(thinking) });
    else if (awaitingHuman) {
      const owe = toCall(hand, HUMAN);
      status = owe > 0 ? fill(t.owe, { n: owe }) : t.yourMove;
      if (owe > 0) button(t.fold, 'plain', () => humanPlay({ type: 'fold' }));
      button(owe > 0 ? fill(t.call, { n: owe }) : t.check, 'primary', () => humanPlay(owe > 0 ? { type: 'call' } : { type: 'check' }));
      const range = raiseRange(hand);
      if (range) {
        raiseTo = Math.min(range.max, Math.max(range.min, raiseTo));
        const label = (): string => (raiseTo >= range.max ? t.allIn : fill(hand.currentBet > 0 ? t.raiseTo : t.bet, { n: raiseTo }));
        const raiseButton = button(label(), 'plain raise', () => humanPlay({ type: 'raise', to: raiseTo }));
        const box = document.createElement('div');
        box.className = 'sizing';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(range.min);
        slider.max = String(range.max);
        slider.step = String(Math.max(1, hand.sb));
        slider.value = String(raiseTo);
        slider.addEventListener('input', () => {
          raiseTo = Number(slider.value);
          raiseButton.textContent = label();
        });
        slider.addEventListener('click', (e) => e.stopPropagation());
        box.appendChild(slider);
        const preset = (text: string, to: number): void => {
          const b = document.createElement('button');
          b.className = 'ghost';
          b.textContent = text;
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            raiseTo = Math.min(range.max, Math.max(range.min, Math.round(to)));
            slider.value = String(raiseTo);
            raiseButton.textContent = label();
          });
          box.appendChild(b);
        };
        const potNow = pot(hand) + owe;
        preset(t.minBet, range.min);
        preset(t.halfPot, hand.currentBet + potNow / 2);
        preset(t.fullPot, hand.currentBet + potNow);
        preset(t.allIn, range.max);
        buttonsEl.appendChild(box);
      }
      if (aid('hints')) {
        button(t.hint, 'plain', () => {
          showHint = true;
          void analyse();
          render();
        });
      }
    }
    let hintText = '';
    if (showHint && awaitingHuman) hintText = advice ? fill(t.hintP, { move: moveText(advice.action) }) : t.hintThinking;
    statusEl.textContent = hintText || notice || status;
    statusEl.classList.toggle('advice', hintText !== '');
  }

  function renderBar(): void {
    document.documentElement.lang = settings.lang;
    document.title = POKER_PAGES[settings.lang].title;
    $('brand').textContent = t.title;
    $('meta').innerHTML =
      `<span>${fill(t.blinds, { sb: hand.sb, bb: hand.bb })}</span>` + `<span>${fill(t.handNo, { n: handNo + 1 })}</span>`;
    const tally = tallies[tallyKey()];
    $('score').textContent = tally && tally.games > 0 ? fill(t.pTally, { ...tally }) : '';
    $('btn-new').textContent = t.newGame;
    $('btn-settings').textContent = t.settings;
    $('btn-about').firstElementChild!.textContent = t.about;
    $('btn-about').setAttribute('aria-label', t.about);
    if (aboutLang !== settings.lang) {
      aboutLang = settings.lang;
      $('langs').innerHTML = otherLangs(settings.lang)
        .map((l) => `<a class="ghost" href="${ROOT}${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
        .join('');
      $('about-body').innerHTML = POKER_PAGES[settings.lang].about;
      $('about-close').textContent = t.close;
    }
  }

  // ------------------------------------------------------------------ dialogs

  function openSettings(): void {
    const seg = (name: string, options: [string, string][], current: string): string =>
      `<div class="seg">${options
        .map(
          ([value, label]) =>
            `<label><input type="radio" name="${name}" value="${value}"${value === current ? ' checked' : ''}><span>${label}</span></label>`,
        )
        .join('')}</div>`;
    const check = (name: string, label: string, on: boolean): string =>
      `<label class="check"><input type="checkbox" name="${name}"${on ? ' checked' : ''}><span>${label}</span></label>`;
    const row = (label: string, control: string, cls = ''): string =>
      `<div class="row${cls}"><span>${label}</span>${control}</div>`;

    let picked = [...settings.opponents];
    let shown: 'all' | Character['style'] = 'all';
    const roster = (): string =>
      CHARACTERS.filter((c) => shown === 'all' || c.style === shown)
        .map((c) => {
          const order = picked.indexOf(c.id);
          const rating = ratingOf(c);
          const stars = [1, 2, 3, 4, 5]
            .map((n) => `<button type="button" data-star="${n}"${n <= rating ? ' class="lit"' : ''} aria-label="${n} / 5">★</button>`)
            .join('');
          const usual = rating === c.rating ? '' : ` custom" title="${t.usually} ${'★'.repeat(c.rating)}`;
          return (
            `<div class="pick${order >= 0 ? ' on' : ''}" data-id="${c.id}">` +
            `<button type="button" class="face" aria-pressed="${order >= 0}">` +
            (settings.portraits ? `<img src="${avatarUrl(c, 'neutral')}" alt="">` : '') +
            `<b>${c.name[settings.lang]}</b></button>` +
            `<span class="stars${usual}">${stars}</span>` +
            (settings.speech ? `<button type="button" class="hear" aria-label="${t.hear}" title="${t.hear}">▶</button>` : '') +
            (order >= 0 ? `<em>${order + 1}</em>` : '') +
            `</div>`
          );
        })
        .join('');

    settingsDialog.innerHTML =
      `<form method="dialog"><h2>${t.newGame}</h2>` +
      `<div class="cols"><div class="col">` +
      `<fieldset class="group"><legend>${t.setOpponents}</legend>` +
      seg('shown', [['all', t.all], ['real', t.realistic], ['cartoon', t.cartoon]], shown) +
      `<div class="roster"></div><p class="fine">${t.pickHintP}</p>` +
      `</fieldset>` +
      `</div><div class="col">` +
      `<fieldset class="group"><legend>${t.secGame}</legend>` +
      row(t.setSpeed, seg('pace', [['400', t.fast], ['800', t.normal], ['1400', t.deep]], String(settings.pace))) +
      `</fieldset>` +
      `<fieldset class="group"><legend>${t.secTable}</legend>` +
      check('portraits', t.setPortraits, settings.portraits) +
      row(t.portraitKind, seg('avatars', [['static', t.avStatic], ['context', t.avContext]], settings.avatars), ' sub') +
      check('phrases', t.setPhrases, settings.phrases) +
      check('speech', t.setSpeech, settings.speech) +
      `</fieldset>` +
      `<fieldset class="group training"${settings.training ? '' : ' disabled'}>` +
      `<legend title="${t.aidNote}"><label><input type="checkbox" name="training"${settings.training ? ' checked' : ''}>` +
      `<span>${t.training}</span></label></legend>` +
      `<p class="fine">${t.aidNote}</p>` +
      check('equity', t.setEquity, settings.equity) +
      check('hints', t.setHints, settings.hints) +
      check('openCards', t.setOpen, settings.openCards) +
      `</fieldset>` +
      `</div></div>` +
      `<p class="fine">${t.fairnessP}</p>` +
      `<div class="buttons"><button type="button" class="plain" data-act="reset">${t.resetTally}</button>` +
      `<button type="button" class="plain" data-act="close">${t.close}</button>` +
      `<button class="primary" value="start">${t.start}</button></div></form>`;
    const form = settingsDialog.querySelector('form')!;
    const rosterEl = form.querySelector<HTMLElement>('.roster')!;
    rosterEl.innerHTML = roster();
    rosterEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const id = target.closest<HTMLElement>('.pick')?.dataset.id;
      if (!id) return;
      const star = target.closest<HTMLElement>('[data-star]')?.dataset.star;
      if (target.closest('.hear')) {
        const c = characterById(id);
        void audition(remark(c.id, 'greet', settings.lang), c, settings.lang);
        return;
      }
      if (star) {
        const ratings = { ...settings.ratings, [id]: Number(star) as Rating };
        if (ratings[id] === characterById(id).rating) delete ratings[id];
        apply({ ratings });
      } else if (!target.closest('.face')) {
        return;
      } else if (picked.includes(id)) {
        if (picked.length > 1) picked = picked.filter((x) => x !== id);
      } else {
        picked = [...picked, id].slice(-5);
      }
      rosterEl.innerHTML = roster();
    });
    for (const radio of form.querySelectorAll<HTMLInputElement>('[name=shown]')) {
      radio.addEventListener('change', () => {
        shown = radio.value as typeof shown;
        rosterEl.innerHTML = roster();
      });
    }
    form.querySelector('[data-act=close]')!.addEventListener('click', () => settingsDialog.close());
    form.querySelector('[data-act=reset]')!.addEventListener('click', () => {
      tallies = {};
      save('poker.tally', tallies, session);
      render();
    });
    const apply = (change: Partial<Settings>): void => {
      settings = { ...settings, ...change };
      if ('speech' in change) {
        if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
        else releaseVoices();
      }
      if (awaitingHuman && aid('equity')) void analyse();
      save('poker.settings', settings);
      render();
    };
    const kinds = form.querySelector<HTMLElement>('.row.sub')!;
    const showKinds = (): void => {
      kinds.classList.toggle('off', !settings.portraits);
      for (const radio of kinds.querySelectorAll('input')) radio.disabled = !settings.portraits;
    };
    showKinds();
    for (const name of ['portraits', 'phrases', 'speech', 'equity', 'hints', 'openCards', 'training'] as const) {
      const box = form.querySelector<HTMLInputElement>(`[name=${name}]`)!;
      box.addEventListener('change', () => {
        apply({ [name]: box.checked });
        if (name === 'speech' || name === 'portraits') rosterEl.innerHTML = roster();
        if (name === 'portraits') showKinds();
        if (name === 'training') form.querySelector('.training')!.toggleAttribute('disabled', !box.checked);
      });
    }
    for (const radio of form.querySelectorAll<HTMLInputElement>('[name=avatars]')) {
      radio.addEventListener('change', () => apply({ avatars: radio.value as AvatarMode }));
    }
    for (const radio of form.querySelectorAll<HTMLInputElement>('[name=pace]')) {
      radio.addEventListener('change', () => apply({ pace: Number(radio.value) }));
    }
    form.addEventListener('submit', () => {
      settings = { ...settings, opponents: picked };
      save('poker.settings', settings);
      newTournament();
    });
    settingsDialog.showModal();
  }

  $('btn-new').addEventListener('click', newTournament);
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-about').addEventListener('click', () => aboutDialog.showModal());
  $('langs').addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('a[data-lang]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    settings = { ...settings, lang: link.dataset.lang as Lang };
    t = PSTRINGS[settings.lang];
    save('poker.settings', settings);
    try {
      history.replaceState(null, '', `${ROOT}${settings.lang}/`);
    } catch {
      // Not every place a page can be opened from allows this; the switch still works.
    }
    if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const primary = (resultEl.hidden ? buttonsEl : resultEl).querySelector<HTMLButtonElement>('.primary');
    if (primary) {
      e.preventDefault();
      primary.click();
    }
  });
  new ResizeObserver(() => {
    if (hand) render();
  }).observe(stage);

  const firstVisit = load<Partial<Settings>>('poker.settings', {}).opponents === undefined;
  newTournament();
  if (firstVisit) openSettings();
}
