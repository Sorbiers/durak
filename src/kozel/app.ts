import { Card, DECK_SIZE, SUIT_SYMBOLS, rankOf, suitOf } from '../engine/cards';
import { cryptoRng } from '../engine/rng';
import { KOZEL_PAGES, otherLangs } from '../seo';
import { cardElement, isRed, suitSvg } from '../ui/cardDom';
import { CHARACTERS, Character, Mood, avatarUrl, characterById, preloadAvatars } from '../ui/characters';
import { Lang, fill } from '../ui/i18n';
import { REMARK_CHANCE, Remark, remark } from '../ui/phrases';
import { PAGE_LANG, ROOT, browserLang } from '../ui/root';
import { audition, prepareVoices, releaseVoices, speak, stopSpeaking } from '../ui/speech';
import { KOZEL_SKILLS, KozelDecision, observe } from './ai';
import { KozelClient } from './client';
import {
  GAME_TO,
  KozelState,
  Move,
  PLAYERS,
  applyMove,
  cloneState,
  dealPenalty,
  legalMoves,
  newDeal,
  pointsOf,
  setBeats,
  teamOf,
} from './engine';
import { KSTRINGS, KozelStrings } from './i18n';
import { KozelGeometry, computeLayout } from './layout';

const HUMAN = 0;
const BOT_PAUSE = 650; // a computer move is never shown sooner than this
const TRICK_PAUSE = 1300; // a finished trick stays on the table this long

type AvatarMode = 'static' | 'context';
type Rating = 1 | 2 | 3 | 4 | 5;

interface Settings {
  // The other three, clockwise from the player's left: an opponent, the partner, an opponent.
  players: string[];
  ratings: Record<string, Rating>;
  thinkMs: number;
  portraits: boolean;
  avatars: AvatarMode;
  phrases: boolean;
  speech: boolean;
  hints: boolean;
  openCards: boolean;
  training: boolean;
  lang: Lang;
}

/** Whole games, to twelve, against one table. */
interface Tally {
  games: number;
  wins: number;
  losses: number;
}

const NO_TALLY: Tally = { games: 0, wins: 0, losses: 0 };

const DEFAULTS: Settings = {
  players: ['lev', 'vera', 'gleb'],
  ratings: {},
  thinkMs: 1500,
  portraits: true,
  avatars: 'context',
  phrases: true,
  speech: false,
  hints: false,
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

export function startKozel(): void {
  const stage = $('stage');
  const cardsLayer = $('cards');
  const seatsLayer = $('seats');
  const statusEl = $('status');
  const buttonsEl = $('buttons');
  const resultEl = $('result');
  const settingsDialog = $<HTMLDialogElement>('settings');
  const aboutDialog = $<HTMLDialogElement>('about');
  let aboutLang: Lang | undefined;

  const ai = new KozelClient();
  const analyst = new KozelClient(); // works out the player's hint, so nobody waits for it
  let settings = load('kozel.settings', DEFAULTS);
  const known = settings.players.filter((id) => CHARACTERS.some((c) => c.id === id));
  if (known.length !== 3 || new Set(known).size !== 3) settings = { ...settings, players: DEFAULTS.players };
  if (PAGE_LANG) settings = { ...settings, lang: PAGE_LANG };
  const session = (): Storage => sessionStorage;
  let tallies = load<Record<string, Tally>>('kozel.tally', {}, session);
  let t: KozelStrings = KSTRINGS[settings.lang];

  let game!: KozelState;
  let gameId = 0; // bumped on every new deal so stale replies and timers are ignored
  let moveNo = 0;
  let penalties = [0, 0]; // charged to each pair this game: ours (seats 0, 2), theirs
  let dealer = -1;
  let gameOver = true;
  let awaitingHuman = false;
  let thinking = -1;
  let selected: Card[] = [];
  let notice = '';
  let hint: KozelDecision | null = null;
  let hintPending = false;
  let clearing = false; // a finished trick is on show before it is taken
  let geo: KozelGeometry;
  let lastWhere: string[] = [];
  let seatEls: HTMLElement[] = [];
  let avatarEls: (HTMLImageElement | null)[] = [];
  let roleEls: (HTMLElement | null)[] = [];
  let moods: { mood: Mood; until: number }[] = [];
  let lastNudge = 0;

  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < DECK_SIZE; c++) {
    const el = cardElement(c);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onCardClick(c);
    });
    cardEls.push(el);
    cardsLayer.appendChild(el);
  }

  const aid = (name: 'hints' | 'openCards'): boolean => settings.training && settings[name];
  const cardText = (c: Card): string => t.ranks[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
  const who = (seat: number): Character => characterById(settings.players[seat - 1]);
  const ratingOf = (c: Character): Rating => {
    const chosen = settings.ratings[c.id];
    return chosen >= 1 && chosen <= 5 ? chosen : c.rating;
  };
  const seatName = (seat: number): string => (seat === HUMAN ? t.you : who(seat).name[settings.lang]);
  const tallyKey = (): string => settings.players.map((id) => id + ratingOf(characterById(id))).join('+');
  const partnerOf = (seat: number): number => (seat + 2) % PLAYERS;

  // ---------------------------------------------------------------- game flow

  /** A new game: both pairs start clean, and the first dealer is drawn by lot. */
  function newGame(): void {
    penalties = [0, 0];
    dealer = (cryptoRng() * PLAYERS) | 0;
    gameOver = false;
    deal(true);
  }

  function deal(first = false): void {
    game = newDeal(cryptoRng, dealer);
    const id = ++gameId;
    moveNo = 0;
    awaitingHuman = false;
    thinking = -1;
    selected = [];
    hint = null;
    hintPending = false;
    clearing = false;
    analyst.cancel();
    const leader = game.leader;
    notice = leader === HUMAN ? t.firstLeadYouK : fill(t.firstLeadK, { name: seatName(leader) });
    resultEl.hidden = true;
    moods = Array.from({ length: PLAYERS }, () => ({ mood: 'neutral' as Mood, until: 0 }));
    stopSpeaking();
    const cast = settings.players.map(characterById);
    if (settings.speech) prepareVoices(cast, settings.lang);
    if (settings.portraits) cast.forEach(preloadAvatars);
    buildSeats();
    lastWhere = new Array(DECK_SIZE).fill('deck');
    render(true);
    setTimeout(() => {
      if (id !== gameId) return;
      render();
      if (first) react(1 + ((Math.random() * 3) | 0), 'greet');
      setTimeout(() => void run(id), leader === HUMAN ? 700 : 1800);
    }, 40);
  }

  async function run(id: number): Promise<void> {
    while (id === gameId && !game.over) {
      const seat = game.turn;
      if (seat === HUMAN) {
        awaitingHuman = true;
        render();
        nudgeLater(id);
        return;
      }
      thinking = seat;
      render();
      const started = performance.now();
      const decision = await ai.request(observe(game, seat), KOZEL_SKILLS[ratingOf(who(seat))], settings.thinkMs);
      if (id !== gameId) return;
      const pause = BOT_PAUSE - (performance.now() - started);
      if (pause > 0) await sleep(pause);
      if (id !== gameId) return;
      thinking = -1;
      await play(decision.move, id);
    }
    if (id === gameId && game.over) finishDeal();
  }

  async function play(m: Move, id: number): Promise<void> {
    const seat = game.turn;
    if (moveNo === 0) notice = '';
    moveNo++;
    hint = null;
    hintPending = false;
    analyst.cancel();
    const before = game;
    const next = cloneState(game);
    applyMove(next, m);
    if (game.table.length > 0) react(seat, m.open ? 'kBeat' : 'kSlip');
    else react(seat, 'lead');

    if (before.table.length === PLAYERS - 1) {
      // The last play of the trick: show it landing, and who takes the trick, before it goes.
      const mid = cloneState(game);
      for (const c of m.cards) mid.hands[seat].splice(mid.hands[seat].indexOf(c), 1);
      mid.table.push({ seat, cards: m.cards.slice(), open: m.open });
      if (m.open) mid.best = mid.table.length - 1;
      game = mid;
      clearing = true;
      const winner = mid.table[mid.best].seat;
      const worth = mid.table.reduce((sum, p) => sum + p.cards.reduce((a, c) => a + pointsOf(c), 0), 0);
      notice = winner === HUMAN ? t.trickYou : fill(t.trickTo, { name: seatName(winner) });
      render();
      remarkOnTrick(winner, worth);
      await sleep(TRICK_PAUSE);
      if (id !== gameId) return;
      clearing = false;
      notice = '';
      if (before.stock.length > 0 && next.stock.length === 0 && !next.over) {
        setTimeout(() => {
          if (id === gameId) react(1 + ((Math.random() * 3) | 0), 'deckOut');
        }, 900);
      }
    }
    game = next;
    render();
    await sleep(before.table.length === PLAYERS - 1 ? 520 : 200);
  }

  /** The winner of a trick may say so; a rich one pleases them, and their partner may cheer. */
  function remarkOnTrick(winner: number, worth: number): void {
    if (worth >= 20) {
      setMood(winner, 'happy');
      react(winner, 'kRich');
      const partner = partnerOf(winner);
      if (partner !== HUMAN) setTimeout(() => react(partner, 'kPartner', 'pleased'), 900);
      // The other pair are not so pleased.
      for (let p = 1; p < PLAYERS; p++) if (teamOf(p) !== teamOf(winner)) setMood(p, 'sad');
    } else react(winner, 'kTrick');
  }

  function finishDeal(): void {
    awaitingHuman = false;
    const pen = dealPenalty(game);
    penalties = [penalties[0] + pen[0], penalties[1] + pen[1]];
    const ourPts = game.points[0];
    const theirPts = game.points[1];
    const lines = [fill(t.dealOver, { a: ourPts, b: theirPts })];
    if (pen[0] > 0) lines.push(fill(t.chargeUs, { n: pen[0] }));
    else if (pen[1] > 0) lines.push(fill(t.chargeThem, { n: pen[1] }));
    else lines.push(t.eggs);

    // The pairs take it as you would expect.
    const said = (team: number, what: Remark, mood: Mood): void => {
      const seats = [0, 1, 2, 3].filter((p) => p !== HUMAN && teamOf(p) === team);
      seats.forEach((p) => setMood(p, mood, Infinity));
      react(seats[(Math.random() * seats.length) | 0], what);
    };
    let headline: string;
    let lost = false;
    gameOver = penalties[0] >= GAME_TO || penalties[1] >= GAME_TO;
    if (gameOver) {
      const weLost = penalties[0] >= GAME_TO;
      lost = weLost;
      headline = weLost ? t.weGoats : t.theyGoats;
      said(weLost ? 1 : 0, 'kGoats', 'happy');
      setTimeout(() => said(weLost ? 0 : 1, 'kWeGoats', 'angry'), 1200);
      const key = tallyKey();
      const tally: Tally = { ...NO_TALLY, ...tallies[key] };
      tally.games++;
      if (weLost) tally.losses++;
      else tally.wins++;
      tallies = { ...tallies, [key]: tally };
      save('kozel.tally', tallies, session);
    } else if (pen[0] === pen[1]) {
      headline = t.eggs;
      lines.pop();
      said(1, 'kEggs', 'surprised');
    } else {
      lost = pen[0] > 0;
      headline = lines.pop()!;
      said(lost ? 1 : 0, 'kDealWon', 'pleased');
      setTimeout(() => said(lost ? 0 : 1, 'kDealLost', 'sad'), 1100);
    }
    resultEl.innerHTML = `<p></p><small></small><button class="primary"></button>`;
    resultEl.querySelector('p')!.textContent = headline;
    resultEl.querySelector('small')!.textContent = lines.join(' ');
    const button = resultEl.querySelector('button')!;
    button.textContent = gameOver ? t.newGame : t.nextDeal;
    button.addEventListener('click', () => {
      if (gameOver) newGame();
      else {
        dealer = (dealer + 1) % PLAYERS;
        deal();
      }
    });
    resultEl.className = lost ? 'lost' : '';
    resultEl.hidden = false;
    render();
  }

  function nudgeLater(id: number): void {
    const at = moveNo;
    setTimeout(() => {
      const now = performance.now();
      if (id !== gameId || moveNo !== at || !awaitingHuman || now - lastNudge < 180_000) return;
      lastNudge = now;
      react(1 + ((Math.random() * 3) | 0), 'waiting');
    }, 40_000);
  }

  // -------------------------------------------------------------- human input

  /** How many cards the player must put down now; 0 when they lead and may choose. */
  const needed = (): number => (game.table.length === 0 ? 0 : game.table[game.best].cards.length);

  function onCardClick(c: Card): void {
    if (!awaitingHuman || !game.hands[HUMAN].includes(c)) return;
    const n = needed();
    if (selected.includes(c)) {
      // A second click on a lone lifted card plays it, when that is all the move needs.
      if (selected.length === 1 && (n === 0 || n === 1)) {
        playSelected(n === 1 && setBeats([c], game.table[game.best].cards, game.trump));
        return;
      }
      selected = selected.filter((x) => x !== c);
    } else if (n === 0) {
      // A lead is of one suit: a card of another suit starts the choice afresh.
      selected = selected.length > 0 && suitOf(selected[0]) !== suitOf(c) ? [c] : [...selected, c];
    } else {
      selected = [...selected, c].slice(-n);
    }
    notice = '';
    render();
  }

  function playSelected(open: boolean): void {
    if (!awaitingHuman || selected.length === 0) return;
    const m: Move = { cards: selected.slice(), open: game.table.length === 0 ? true : open };
    const legal = legalMoves(game).some(
      (x) => x.open === m.open && x.cards.length === m.cards.length && x.cards.every((c) => m.cards.includes(c)),
    );
    if (!legal) {
      notice = t.oneSuit;
      render();
      return;
    }
    awaitingHuman = false;
    selected = [];
    notice = '';
    const id = gameId;
    void play(m, id).then(() => {
      if (id === gameId) void run(id);
    });
  }

  function cancelSelection(): void {
    if (selected.length === 0) return;
    selected = [];
    notice = '';
    render();
  }

  async function askHint(): Promise<void> {
    if (!awaitingHuman || hintPending) return;
    const id = gameId;
    const at = moveNo;
    hintPending = true;
    notice = '';
    render();
    const decision = await analyst.request(observe(game, HUMAN), KOZEL_SKILLS[5], settings.thinkMs, true);
    if (id !== gameId || at !== moveNo) return;
    hintPending = false;
    hint = decision;
    selected = decision.move.cards.slice();
    render();
  }

  function hintLine(): string {
    if (hintPending) return t.hintThinking;
    if (!hint) return '';
    const cards = hint.move.cards.map(cardText).join(' ');
    const move = game.table.length > 0 && !hint.move.open ? fill(t.faceDownMove, { cards }) : cards;
    return fill(t.hintK, { move });
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
    if (seat === HUMAN) return;
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
    roleEls = [];
    for (let p = 0; p < PLAYERS; p++) {
      let avatar: HTMLImageElement | null = null;
      let role: HTMLElement | null = null;
      if (p !== HUMAN) {
        avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.alt = '';
        avatar.draggable = false;
        seatsLayer.appendChild(avatar);
        role = document.createElement('div');
        role.className = 'role-chip';
        seatsLayer.appendChild(role);
      }
      avatarEls.push(avatar);
      roleEls.push(role);
      const el = document.createElement('div');
      el.className = p === HUMAN ? 'seat me' : `seat${teamOf(p) === teamOf(HUMAN) ? ' partner' : ''}`;
      el.innerHTML =
        `<span class="name"></span><span class="role"></span>` +
        `<span class="dots"><i></i><i></i><i></i></span><span class="bubble"></span>`;
      seatsLayer.appendChild(el);
      seatEls.push(el);
    }
  }

  function render(instant = false): void {
    const rect = stage.getBoundingClientRect();
    const lay = (portraits: 'off' | 'normal' | 'large') =>
      computeLayout(game, rect.width, rect.height, {
        human: HUMAN,
        selected,
        revealAll: aid('openCards'),
        portraits,
      });
    // Portraits are large unless that would crowd the table.
    let layout = lay(settings.portraits ? 'large' : 'off');
    const large = settings.portraits && rect.height > 560 && rect.width > 900;
    if (settings.portraits && !large) layout = lay('normal');
    geo = layout.geo;
    stage.style.setProperty('--cw', `${geo.cw}px`);
    stage.classList.toggle('instant', instant);
    stage.classList.toggle('big-portraits', large);

    const n = needed();
    const mine = new Set(game.hands[HUMAN]);
    const hinted = new Set<Card>(hint && awaitingHuman ? hint.move.cards : []);
    let drawn = 0;
    for (let c = 0; c < DECK_SIZE; c++) {
      const el = cardEls[c];
      const place = layout.places.get(c);
      if (!place) continue;
      const p = instant ? { ...place, x: geo.deck.x, y: geo.deck.y, rot: 0, scale: 1, up: false } : place;
      // Cards drawn after a trick leave the deck one after another.
      const delay = !instant && lastWhere[c] === 'deck' && p.where === 'hand' ? 200 + drawn++ * 70 : 0;
      if (!instant) lastWhere[c] = p.where;
      el.style.setProperty('--wait', `${delay}ms`);
      el.style.transform = `translate(${p.x - geo.cw / 2}px, ${p.y - geo.ch / 2}px) rotate(${p.rot}deg) scale(${p.scale})`;
      el.style.zIndex = String(p.z);
      el.classList.toggle('up', p.up);
      const own = mine.has(c) && p.where === 'hand';
      el.classList.toggle('liftable', own && awaitingHuman);
      el.classList.toggle('selected', selected.includes(c));
      el.classList.toggle('hinted', hinted.has(c));
      el.classList.toggle('playable', false);
      el.classList.toggle('dim', false);
      el.classList.toggle('trump', false);
      for (const r of el.querySelectorAll('.rank')) r.textContent = t.ranks[rankOf(c)];
      if (p.up) el.setAttribute('aria-label', cardText(c));
      else el.removeAttribute('aria-label');
      if (own && awaitingHuman) el.setAttribute('role', 'button');
      else el.removeAttribute('role');
    }
    if (instant) void stage.offsetWidth;

    renderSeats();
    renderPiles();
    renderActions(n);
    renderBar();
  }

  function renderSeats(): void {
    for (let p = 0; p < seatEls.length; p++) {
      const el = seatEls[p];
      const at = geo.seats[p];
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
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
          avatar.classList.toggle('active', !game.over && game.turn === p);
        }
      }
      el.classList.toggle('active', !game.over && game.turn === p && !clearing);
      el.classList.toggle('thinking', thinking === p);
      el.querySelector('.name')!.textContent =
        p === HUMAN ? t.you : seatName(p) + (teamOf(p) === teamOf(HUMAN) ? ` · ${t.partner}` : '');
      // Who leads, and who is taking the trick so far.
      const taking = game.table.length > 0 && game.table[game.best].seat === p;
      const leads = game.table.length === 0 && game.turn === p && !game.over;
      const word = taking ? t.winning : leads ? (p === HUMAN ? t.youAttack : t.attacks) : '';
      const part = taking ? 'defend' : leads ? 'attack' : '';
      const plateRole = el.querySelector<HTMLElement>('.role')!;
      plateRole.textContent = p === HUMAN ? word : '';
      plateRole.className = `role${p === HUMAN && part ? ` ${part}` : ''}`;
      const chip = roleEls[p];
      const where = geo.roles[p];
      if (chip && where) {
        chip.textContent = word;
        chip.className = `role-chip${part ? ` ${part}` : ''}`;
        chip.style.left = `${where.x}px`;
        chip.style.top = `${where.y}px`;
      }
    }
  }

  function renderPiles(): void {
    const mark = $('trump-mark');
    mark.innerHTML = suitSvg(game.trump);
    mark.className = isRed(game.trump) ? 'red' : 'black';
    mark.style.left = `${geo.deck.x}px`;
    mark.style.top = `${geo.deck.y}px`;
    mark.classList.toggle('bare', game.stock.length === 0);
    const deckLabel = $('deck-count');
    deckLabel.textContent = game.stock.length > 0 ? `${t.deck} · ${game.stock.length}` : '';
    deckLabel.style.left = `${geo.deck.x + geo.cw * 0.2}px`;
    deckLabel.style.top = `${geo.deck.y - geo.ch / 2 - 26}px`;
    const piles: [string, number][] = [
      ['pile-us', teamOf(HUMAN)],
      ['pile-them', 1 - teamOf(HUMAN)],
    ];
    for (const [id, team] of piles) {
      const label = $(id);
      const at = geo.piles[team];
      label.textContent = `${team === teamOf(HUMAN) ? t.we : t.they} · ${fill(t.tricks, { n: game.tricks[team] })}`;
      label.style.left = `${Math.min(at.x, stage.clientWidth - 70)}px`;
      label.style.top = `${team === teamOf(HUMAN) ? at.y - geo.cw * 0.5 - 22 : at.y + geo.cw * 0.5 + 6}px`;
    }
  }

  function renderActions(n: number): void {
    const actions = $('actions');
    actions.style.top = `${geo.actionY}px`;
    buttonsEl.innerHTML = '';
    const button = (label: string, cls: string, onClick: () => void): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = cls;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      buttonsEl.appendChild(b);
    };
    let status = '';
    if (game.over || clearing) status = '';
    else if (thinking >= 0) status = fill(t.thinking, { name: seatName(thinking) });
    else if (awaitingHuman) {
      if (n === 0) {
        status = t.yourLeadK;
        if (selected.length > 0) button(t.play, 'primary', () => playSelected(true));
      } else {
        status = fill(t.yourTurnK, { n });
        if (selected.length === n) {
          const beats = setBeats(selected, game.table[game.best].cards, game.trump);
          if (beats) button(t.beat, 'primary', () => playSelected(true));
          button(t.faceDown, beats ? 'plain' : 'primary', () => playSelected(false));
        }
      }
      if (selected.length > 0) button(t.cancel, 'plain', cancelSelection);
      if (aid('hints')) button(t.hint, 'plain', () => void askHint());
    }
    statusEl.textContent = notice || hintLine() || status;
    statusEl.classList.toggle('advice', !notice && (hint !== null || hintPending));
  }

  function renderBar(): void {
    document.documentElement.lang = settings.lang;
    document.title = KOZEL_PAGES[settings.lang].title;
    $('brand').textContent = t.title;
    $('meta').innerHTML =
      `<span class="trump-chip ${isRed(game.trump) ? 'red' : 'black'}">${t.trump} ${suitSvg(game.trump)}</span>` +
      `<span>${fill(t.score, { we: t.we, they: t.they, a: penalties[0], b: penalties[1] })}</span>`;
    const tally = tallies[tallyKey()];
    $('score').textContent = tally && tally.games > 0 ? fill(t.kTally, { ...tally }) : '';
    $('btn-new').textContent = t.newGame;
    $('btn-settings').textContent = t.settings;
    $('btn-about').firstElementChild!.textContent = t.about;
    $('btn-about').setAttribute('aria-label', t.about);
    if (aboutLang !== settings.lang) {
      aboutLang = settings.lang;
      $('langs').innerHTML = otherLangs(settings.lang)
        .map((l) => `<a class="ghost" href="${ROOT}${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
        .join('');
      $('about-body').innerHTML = KOZEL_PAGES[settings.lang].about;
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

    // Three are picked, in seating order clockwise from the player's left; the second is the partner.
    let picked = [...settings.players];
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
            `<div class="pick${order >= 0 ? ' on' : ''}${order === 1 ? ' mate' : ''}" data-id="${c.id}">` +
            `<button type="button" class="face" aria-pressed="${order >= 0}">` +
            (settings.portraits ? `<img src="${avatarUrl(c, 'neutral')}" alt="">` : '') +
            `<b>${c.name[settings.lang]}</b></button>` +
            `<span class="stars${usual}">${stars}</span>` +
            (settings.speech ? `<button type="button" class="hear" aria-label="${t.hear}" title="${t.hear}">▶</button>` : '') +
            (order >= 0 ? `<em${order === 1 ? ` title="${t.partner}"` : ''}>${order === 1 ? '♥' : order + 1}</em>` : '') +
            `</div>`
          );
        })
        .join('');

    settingsDialog.innerHTML =
      `<form method="dialog"><h2>${t.newGame}</h2>` +
      `<div class="cols"><div class="col">` +
      `<fieldset class="group"><legend>${t.players}</legend>` +
      seg('shown', [['all', t.all], ['real', t.realistic], ['cartoon', t.cartoon]], shown) +
      `<div class="roster"></div><p class="fine">${t.pickHintK}</p>` +
      `</fieldset>` +
      `</div><div class="col">` +
      `<fieldset class="group"><legend>${t.secGame}</legend>` +
      row(t.setThink, seg('thinkMs', [['600', t.fast], ['1500', t.normal], ['4000', t.deep]], String(settings.thinkMs))) +
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
      check('hints', t.setHints, settings.hints) +
      check('openCards', t.setOpen, settings.openCards) +
      `</fieldset>` +
      `</div></div>` +
      `<p class="fine">${t.fairnessK}</p>` +
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
        picked = picked.filter((x) => x !== id);
      } else {
        picked = [...picked, id].slice(-3); // a fourth pick replaces the first
      }
      rosterEl.innerHTML = roster();
      start.disabled = picked.length !== 3;
    });
    for (const radio of form.querySelectorAll<HTMLInputElement>('[name=shown]')) {
      radio.addEventListener('change', () => {
        shown = radio.value as typeof shown;
        rosterEl.innerHTML = roster();
      });
    }
    const start = form.querySelector<HTMLButtonElement>('button[value=start]')!;
    form.querySelector('[data-act=close]')!.addEventListener('click', () => settingsDialog.close());
    form.querySelector('[data-act=reset]')!.addEventListener('click', () => {
      tallies = {};
      save('kozel.tally', tallies, session);
      render();
    });
    const apply = (change: Partial<Settings>): void => {
      settings = { ...settings, ...change };
      if (!aid('hints')) hint = null;
      if ('speech' in change) {
        if (settings.speech) prepareVoices(settings.players.map(characterById), settings.lang);
        else releaseVoices();
      }
      save('kozel.settings', settings);
      render();
    };
    const kinds = form.querySelector<HTMLElement>('.row.sub')!;
    const showKinds = (): void => {
      kinds.classList.toggle('off', !settings.portraits);
      for (const radio of kinds.querySelectorAll('input')) radio.disabled = !settings.portraits;
    };
    showKinds();
    for (const name of ['portraits', 'phrases', 'speech', 'hints', 'openCards', 'training'] as const) {
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
    form.addEventListener('submit', (e) => {
      if (picked.length !== 3) {
        e.preventDefault();
        return;
      }
      const data = new FormData(form);
      settings = { ...settings, players: picked, thinkMs: Number(data.get('thinkMs')) };
      save('kozel.settings', settings);
      newGame();
    });
    settingsDialog.showModal();
  }

  $('btn-new').addEventListener('click', newGame);
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-about').addEventListener('click', () => aboutDialog.showModal());
  $('langs').addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('a[data-lang]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    settings = { ...settings, lang: link.dataset.lang as Lang };
    t = KSTRINGS[settings.lang];
    save('kozel.settings', settings);
    try {
      history.replaceState(null, '', `${ROOT}${settings.lang}/`);
    } catch {
      // Not every place a page can be opened from allows this; the switch still works.
    }
    if (settings.speech) prepareVoices(settings.players.map(characterById), settings.lang);
    render();
  });
  stage.addEventListener('click', cancelSelection);
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') {
      cancelSelection();
      return;
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const primary = (resultEl.hidden ? buttonsEl : resultEl).querySelector<HTMLButtonElement>('.primary');
    if (primary) {
      e.preventDefault();
      primary.click();
    }
  });
  new ResizeObserver(() => {
    if (game) render();
  }).observe(stage);

  const firstVisit = load<Partial<Settings>>('kozel.settings', {}).players === undefined;
  newGame();
  if (firstVisit) openSettings();
}
