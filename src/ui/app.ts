import { AiDecision, Rating, skillFor } from '../ai';
import { Card, DECK_SIZE, SUIT_SYMBOLS, rankOf, suitOf } from '../engine/cards';
import {
  ATTACK,
  DEFEND,
  DRAW,
  GameState,
  OVER,
  PASS,
  PILE_ON,
  TAKE,
  applyAction,
  cloneState,
  decodeAction,
  defendAction,
  legalActions,
  lowestTrump,
  newGame,
  openAction,
} from '../engine/game';
import { observe } from '../engine/observe';
import { cryptoRng } from '../engine/rng';
import { AiClient } from './aiClient';
import { CHARACTERS, Character, Mood, avatarUrl, characterById, preloadAvatars } from './characters';
import { Lang, STRINGS, Strings, fill } from './i18n';
import { Geometry, Place, computeLayout } from './layout';
import { REMARK_CHANCE, Remark, plainRemark, remark } from './phrases';
import { audition, prepareVoices, releaseVoices, speak, stopSpeaking } from './speech';

const HUMAN = 0;
const BOT_PAUSE = 700; // a computer move is never shown sooner than this
const COURT_LOW = 5; // jack
const COURT_HIGH = 7; // king
const PICTURE_NAMES = ['jack', 'queen', 'king', 'ace']; // ranks 5..8
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

type AvatarMode = 'off' | 'static' | 'context';

interface Settings {
  opponents: string[]; // character ids, clockwise from the player's left; one to three
  ratings: Record<string, Rating>; // strength chosen for a character in place of their usual one
  transfer: boolean;
  firstBoutFive: boolean;
  // Who leads every game after the first: the previous winner, or the player to the fool's
  // right, leading at the fool.
  nextLead: 'winner' | 'fool';
  thinkMs: number;
  avatars: AvatarMode; // no portraits, one fixed picture, or pictures that follow the game
  largePortraits: boolean;
  phrases: boolean; // opponents make remarks in their own voice
  speech: boolean; // remarks are also read aloud
  showKnown: boolean;
  autoDiscard: boolean; // sweep a beaten bout away without waiting for the player
  hints: boolean; // offer the Hint button
  showArrow: boolean; // draw the arrow from the attacker to the defender
  trumpCount: boolean; // after a game, say how many trumps each player received
  showPlayable: boolean; // dim the cards that cannot be played now
  showTrumps: boolean; // mark trump cards with a brass band
  lang: Lang;
}

interface Tally {
  games: number;
  wins: number; // games the player was first to get out of
  fools: number;
  draws: number;
  tracked: number; // how many of the games had their winner recorded
}

const NO_TALLY: Tally = { games: 0, wins: 0, fools: 0, draws: 0, tracked: 0 };

/**
 * A saved tally made whole. Games played before wins were counted left no record of who won
 * them, so a tally from then starts its count of wins afresh.
 */
function wholeTally(saved: Partial<Tally> | undefined): Tally {
  const tally = { ...NO_TALLY, ...saved };
  if (saved?.tracked === undefined) tally.wins = 0;
  return tally;
}

const DEFAULTS: Settings = {
  opponents: ['boris'],
  ratings: {},
  transfer: false,
  firstBoutFive: true,
  nextLead: 'winner',
  thinkMs: 1500,
  avatars: 'context',
  largePortraits: false,
  phrases: true,
  speech: false,
  showKnown: false,
  autoDiscard: false,
  hints: true,
  showArrow: true,
  trumpCount: false,
  showPlayable: false,
  showTrumps: false,
  lang: navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private window); the game works without it.
  }
}

const SUIT_SVG = [
  '<path d="M50 6C80 32 92 46 92 60c0 13-10 20-20 20-8 0-14-4-18-10 1 10 4 18 10 24H36c6-6 9-14 10-24-4 6-10 10-18 10C18 80 8 73 8 60 8 46 20 32 50 6Z"/>',
  '<path d="M50 88C20 62 8 46 8 30 8 16 19 8 30 8c9 0 16 5 20 13 4-8 11-13 20-13 11 0 22 8 22 22 0 16-12 32-42 58Z"/>',
  '<path d="M50 4c10 18 24 34 40 46-16 12-30 28-40 46C40 78 26 62 10 50 26 38 40 22 50 4Z"/>',
  '<circle cx="50" cy="27" r="20"/><circle cx="27" cy="58" r="20"/><circle cx="73" cy="58" r="20"/><path d="M44 44h12c0 26 3 40 9 50H35c6-10 9-24 9-50Z"/>',
];
const suitSvg = (suit: number): string =>
  `<svg class="suit" viewBox="0 0 100 100" aria-hidden="true">${SUIT_SVG[suit]}</svg>`;
const isRed = (suit: number): boolean => suit === 1 || suit === 2;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function startApp(): void {
  const stage = $('stage');
  const cardsLayer = $('cards');
  const seatsLayer = $('seats');
  const statusEl = $('status');
  const buttonsEl = $('buttons');
  const resultEl = $('result');
  const settingsDialog = $<HTMLDialogElement>('settings');
  const discardDialog = $<HTMLDialogElement>('discard-view');

  const ai = new AiClient();
  let settings = load('durak.settings', DEFAULTS);
  // Stored choices may predate the roster or name someone no longer in it.
  const known = settings.opponents.filter((id) => CHARACTERS.some((c) => c.id === id)).slice(0, 3);
  settings = { ...settings, opponents: known.length > 0 ? known : DEFAULTS.opponents };
  let tallies = load<Record<string, Tally>>('durak.tally', {});
  let t: Strings = STRINGS[settings.lang];

  let game: GameState;
  let gameId = 0; // bumped on every new deal so stale replies and timers are ignored
  let moveNo = 0;
  let awaitingHuman = false;
  let thinking = -1;
  let selected: Card[] = [];
  let notice = '';
  let hint: AiDecision | null = null;
  let hintPending = false;
  let humanLeft = false; // the human got out before the game ended
  let resigned = false; // the human gave the game up
  let resignArmed = false; // "Resign" was pressed once and is waiting to be confirmed
  let clearTable: (() => void) | null = null; // set while a beaten bout waits to be cleared
  // How the last game with this line-up ended, which decides who leads the next one. Both are
  // unset before the first game, when the lowest trump decides.
  let lastWinner: number | undefined; // whoever got out first
  let lastFool: number | undefined; // whoever was left holding cards; unset after a draw
  let firstOut: number | undefined; // the first seat to get rid of every card this game
  // Trumps each seat was dealt and later drew from the deck, to show the deal plays no favourites.
  let trumpsDealt: number[] = [];
  let trumpsDrawn: number[] = [];
  let geo: Geometry;
  let lastWhere: Place['where'][] = [];
  let seatEls: HTMLElement[] = [];
  let avatarEls: (HTMLImageElement | null)[] = [];
  let roleEls: (HTMLElement | null)[] = []; // "leads" / "defends" above each opponent's cards
  // What each seat's face shows for the moment, in "react to the game" mode.
  let moods: { mood: Mood; until: number }[] = [];
  let lastNudge = 0; // when an opponent last remarked on the player taking their time

  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < DECK_SIZE; c++) {
    const el = createCard(c);
    cardEls.push(el);
    cardsLayer.appendChild(el);
  }

  function createCard(c: Card): HTMLElement {
    const suit = suitOf(c);
    const rank = rankOf(c);
    const court = rank >= COURT_LOW && rank <= COURT_HIGH;
    const el = document.createElement('div');
    el.className = `card ${isRed(suit) ? 'red' : 'black'}${court ? ' court' : ''}${rank === 8 ? ' ace' : ''}`;
    const index = `<b class="rank"></b>${suitSvg(suit)}`;
    el.innerHTML =
      `<div class="card-inner"><div class="card-face">` +
      `<span class="idx tl">${index}</span>` +
      `<span class="centre">${court ? '<b class="rank"></b>' : ''}${suitSvg(suit)}</span>` +
      `<span class="idx br">${index}</span>` +
      `</div><div class="card-back"></div></div>`;
    if (rank >= COURT_LOW) {
      // Use the picture if a file exists, as SVG or PNG; without one the drawn face remains.
      const base = `${import.meta.env.BASE_URL}cards/${PICTURE_NAMES[rank - COURT_LOW]}_${SUIT_NAMES[suit]}`;
      const art = document.createElement('img');
      art.className = 'art';
      art.alt = '';
      art.draggable = false;
      art.addEventListener('load', () => el.classList.add('pictured'));
      art.addEventListener('error', () => {
        if (art.src.endsWith('.svg')) art.src = `${base}.png`;
        else art.remove();
      });
      art.src = `${base}.svg`;
      el.querySelector('.card-face')!.appendChild(art);
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onCardClick(c);
    });
    return el;
  }

  const cardText = (c: Card): string => t.ranks[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
  const isOut = (p: number): boolean => game.hands[p].length === 0 && game.deck.length === 0;
  /** The character in an opponent's seat (seats 1 and up). */
  const who = (seat: number): Character => characterById(settings.opponents[seat - 1]);
  /** How strongly a character plays: the player's choice if they made one, else their usual. */
  const ratingOf = (c: Character): Rating => {
    const chosen = settings.ratings[c.id];
    return chosen >= 1 && chosen <= 5 ? chosen : c.rating;
  };
  // Results are kept apart for each line-up and each strength it was played at.
  const tallyKey = (): string =>
    `${settings.transfer ? 't' : 's'}:` +
    settings.opponents.map((id) => id + ratingOf(characterById(id))).join('+');
  const seatName = (seat: number): string =>
    seat === HUMAN ? t.you : who(seat).name[settings.lang];

  // ---------------------------------------------------------------- game flow

  function deal(): void {
    const n = settings.opponents.length + 1;
    // The lead in a later game goes by the table's custom: to the previous winner, or to the
    // player on the fool's right, who leads at the fool. Failing either, the lowest trump.
    const byWinner = settings.nextLead === 'winner';
    const earned = byWinner ? lastWinner : lastFool === undefined ? undefined : (lastFool - 1 + n) % n;
    const winner = earned !== undefined && earned < n ? earned : undefined;
    game = newGame(
      { players: n, transfer: settings.transfer, firstBoutFive: settings.firstBoutFive },
      cryptoRng,
      winner,
    );
    firstOut = undefined;
    trumpsDealt = game.hands.map((h) => h.filter((c) => suitOf(c) === game.trump).length);
    trumpsDrawn = game.hands.map(() => 0);
    const id = ++gameId;
    clearTable?.(); // release a bout of the previous deal that was waiting to be cleared
    clearTable = null;
    moveNo = 0;
    awaitingHuman = false;
    thinking = -1;
    selected = [];
    // Say who leads and why; it stays up until the first card is played.
    const leader = game.attacker;
    const mine = leader === HUMAN;
    const shown = winner === undefined ? lowestTrump(game.hands, game.trump) : null;
    notice = fill(
      winner !== undefined
        ? byWinner
          ? mine ? t.firstWinnerYou : t.firstWinner
          : mine ? t.firstFoolYou : t.firstFool
        : shown
          ? mine ? t.firstTrumpYou : t.firstTrump
          : mine ? t.firstLotYou : t.firstLot,
      { name: seatName(leader), card: shown ? cardText(shown.card) : '' },
    );
    hint = null;
    hintPending = false;
    humanLeft = false;
    resigned = false;
    resignArmed = false;
    resultEl.hidden = true;
    moods = Array.from({ length: n }, () => ({ mood: 'neutral' as Mood, until: 0 }));
    stopSpeaking();
    if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
    if (settings.avatars !== 'off') settings.opponents.forEach((o) => preloadAvatars(characterById(o)));
    buildSeats();

    // Gather every card on the deck first, then let the deal fly out from there.
    lastWhere = new Array(DECK_SIZE).fill('deck');
    render(true);
    setTimeout(() => {
      if (id !== gameId) return;
      render();
      react(1 + ((Math.random() * (n - 1)) | 0), 'greet');
      // When an opponent leads, leave a moment to read who leads and why.
      setTimeout(() => void run(id), mine ? 900 : 2200);
    }, 40);
  }

  async function run(id: number): Promise<void> {
    while (id === gameId && game.phase !== OVER) {
      const seat = game.turn;
      if (seat === HUMAN) {
        const legal = legalActions(game, [], true);
        // With nothing to add the pass is automatic, except where it would send a beaten bout
        // to the discard pile: that is left to the player unless they asked otherwise.
        const sweeps = game.phase === ATTACK && !settings.autoDiscard;
        if (legal.length === 1 && legal[0] === PASS && !sweeps) {
          notice = t.nothingToAdd;
          render();
          await sleep(650);
          if (id !== gameId) return;
          notice = '';
          await play(PASS, id);
          continue;
        }
        awaitingHuman = true;
        render();
        nudgeLater(id);
        return;
      }
      thinking = seat;
      render();
      const hurry = isOut(HUMAN); // nobody is waiting for these moves
      const started = performance.now();
      const decision = await ai.request(
        observe(game, seat),
        skillFor(ratingOf(who(seat))),
        hurry ? Math.min(settings.thinkMs, 250) : settings.thinkMs,
      );
      if (id !== gameId) return;
      const pause = (hurry ? 350 : BOT_PAUSE) - (performance.now() - started);
      if (pause > 0) await sleep(pause);
      if (id !== gameId) return;
      thinking = -1;
      await play(decision.action, id);
    }
    if (id === gameId) finish();
  }

  async function play(a: number, id: number): Promise<void> {
    const seat = game.turn;
    const move = decodeAction(a);
    if (moveNo === 0) notice = ''; // the note about who leads has done its job
    moveNo++;
    hint = null;
    hintPending = false;
    const next = cloneState(game);
    applyAction(next, a);
    const wasInDeck = new Set(game.deck);
    next.hands.forEach((hand, p) => {
      for (const c of hand) if (wasInDeck.has(c) && suitOf(c) === next.trump) trumpsDrawn[p]++;
    });
    comment(seat, a, next, id);
    const swept = game.attacks.length > 0 && next.attacks.length === 0;
    if (swept && (move.type === 'defend' || move.type === 'throw')) {
      // The move also ends the bout. Show the card landing before the table is cleared.
      const mid = cloneState(game);
      const hand = mid.hands[seat];
      hand.splice(hand.indexOf(move.card), 1);
      if (move.type === 'defend') {
        mid.defenses[move.index] = move.card;
      } else {
        mid.attacks.push(move.card);
        mid.defenses.push(-1);
      }
      mid.seen[move.card] = 1;
      game = mid;
      render();
      await sleep(650);
      if (id !== gameId) return;
    }
    // A beaten bout stays on the table until the player has had a look and clears it. Their
    // own "Done" already is that decision, and nobody is watching once they are out.
    const beaten = swept && next.discard.length > game.discard.length;
    const ownPass = seat === HUMAN && move.type === 'pass';
    if (beaten && !settings.autoDiscard && !ownPass && !isOut(HUMAN)) {
      await new Promise<void>((resolve) => {
        clearTable = resolve;
        render();
      });
      clearTable = null;
      if (id !== gameId) return;
    }
    game = next;
    if (firstOut === undefined) {
      // Hands empty one move at a time, so this is whoever just played their last card.
      firstOut = [seat, ...game.hands.keys()].find((p) => isOut(p));
    }
    // The player has left the game once a new bout begins without them. Going out in the very
    // bout that ends the game in a draw makes them one of those who drew.
    if (game.phase !== OVER && game.attacks.length === 0 && isOut(HUMAN)) humanLeft = true;
    render();
    await sleep(swept ? 520 : 200);
  }

  /** After a long wait an opponent may say so, but not more than once every few minutes. */
  function nudgeLater(id: number): void {
    const at = moveNo;
    setTimeout(() => {
      const now = performance.now();
      if (id !== gameId || moveNo !== at || !awaitingHuman || now - lastNudge < 180_000) return;
      const waiting = settings.opponents.map((_, i) => i + 1).filter((p) => !isOut(p));
      if (waiting.length === 0) return;
      lastNudge = now;
      react(waiting[(Math.random() * waiting.length) | 0], 'waiting');
    }, 40_000);
  }

  /**
   * Gives the game up: the player is the fool and every hand is shown. The first press only
   * arms the button, so a slip of the hand cannot throw a game away.
   */
  function resign(): void {
    if (!awaitingHuman) return;
    if (!resignArmed) {
      resignArmed = true;
      render();
      const at = moveNo;
      const id = gameId;
      setTimeout(() => {
        if (id === gameId && moveNo === at && resignArmed) {
          resignArmed = false;
          render();
        }
      }, 4000);
      return;
    }
    awaitingHuman = false;
    resignArmed = false;
    resigned = true;
    selected = [];
    notice = '';
    hint = null;
    hintPending = false;
    moveNo++;
    game = { ...cloneState(game), phase: OVER, loser: HUMAN };
    finish();
  }

  function humanPlay(a: number): void {
    if (!awaitingHuman) return;
    awaitingHuman = false;
    resignArmed = false;
    selected = [];
    notice = '';
    const id = gameId;
    void play(a, id).then(() => {
      if (id === gameId) void run(id);
    });
  }

  function finish(): void {
    const key = tallyKey();
    const tally = wholeTally(tallies[key]);
    tally.games++;
    tally.tracked++;
    // A win is being the first to get out; sharing a draw as one of the last two is not one.
    const drewOnly = game.loser === DRAW && !humanLeft;
    if (firstOut === HUMAN && !resigned && !drewOnly) tally.wins++;
    if (game.loser === HUMAN) tally.fools++;
    if (game.loser === DRAW) tally.draws++;
    tallies = { ...tallies, [key]: tally };
    save('durak.tally', tallies);
    // The winner leads the next game. After a resignation with nobody out yet, the only
    // possible winner is the lone opponent of a two-player game.
    lastWinner = firstOut ?? (resigned && game.hands.length === 2 ? 1 : undefined);
    lastFool = game.loser >= 0 ? game.loser : undefined;

    let text: string;
    if (resigned) text = t.youResigned;
    else if (game.loser === HUMAN) text = t.youFool;
    else if (game.loser === DRAW) text = humanLeft ? t.othersDraw : t.youDraw;
    else text = fill(t.youWon, { name: seatName(game.loser) });
    // The fool takes it badly; if that is the player, the others are pleased and one says so.
    if (game.loser > HUMAN) react(game.loser, 'fool', 'angry', Infinity);
    if (game.loser === HUMAN) {
      for (let p = 1; p < game.hands.length; p++) setMood(p, 'happy', Infinity);
      react(1 + ((Math.random() * (game.hands.length - 1)) | 0), 'youFool');
    }
    resultEl.innerHTML = `<p></p><small></small><button class="primary">${t.again}</button>`;
    resultEl.querySelector('p')!.textContent = text;
    resultEl.querySelector('small')!.textContent = settings.trumpCount
      ? `${t.trumpCount}: ` + game.hands.map((_, p) => `${seatName(p)} ${trumpsDealt[p]} + ${trumpsDrawn[p]}`).join(' · ')
      : '';
    resultEl.querySelector('button')!.addEventListener('click', deal);
    resultEl.className = game.loser === HUMAN ? 'lost' : '';
    resultEl.hidden = false;
    render();
  }

  // -------------------------------------------------------------- human input

  /** A short shake: that card cannot be played now. */
  function refuse(c: Card): void {
    const el = cardEls[c];
    el.classList.remove('refused');
    void el.offsetWidth; // restart the animation
    el.classList.add('refused');
  }

  function onCardClick(c: Card): void {
    if (!awaitingHuman) return;
    const legal = legalActions(game, [], true);

    if (game.phase === DEFEND) {
      if (selected.length === 1) {
        // A card is lifted and waiting for its target.
        const index = game.attacks.indexOf(c);
        if (index >= 0 && legal.includes(defendAction(index, selected[0]))) {
          humanPlay(defendAction(index, selected[0]));
          return;
        }
      }
      if (!game.hands[HUMAN].includes(c)) return;
      const options = legal.filter((a) => {
        const m = decodeAction(a);
        return (m.type === 'defend' || m.type === 'transfer') && m.card === c;
      });
      if (options.length === 1) humanPlay(options[0]);
      else if (options.length > 1) {
        selected = selected[0] === c ? [] : [c];
        render();
      } else refuse(c);
      return;
    }

    if (!game.hands[HUMAN].includes(c)) return;
    if (game.attacks.length > 0) {
      if (legal.includes(c)) humanPlay(c);
      else refuse(c);
      return;
    }

    // Opening a bout. A rank held more than once can be led together: click to gather the
    // cards, click a gathered card again (or press Play) to lead them.
    const rank = rankOf(c);
    const sameRank = game.hands[HUMAN].filter((x) => rankOf(x) === rank).length;
    if (sameRank === 1) {
      humanPlay(openAction(rank, 1 << suitOf(c)));
    } else if (selected.includes(c)) {
      playSelection();
    } else {
      selected = selected.length > 0 && rankOf(selected[0]) === rank ? [...selected, c] : [c];
      render();
    }
  }

  function selectionAction(): number {
    let mask = 0;
    for (const c of selected) mask |= 1 << suitOf(c);
    return openAction(rankOf(selected[0]), mask);
  }

  function playSelection(): void {
    if (selected.length === 0) return;
    const a = selectionAction();
    if (legalActions(game, [], true).includes(a)) humanPlay(a);
    else {
      notice = t.tooMany;
      render();
    }
  }

  async function askHint(): Promise<void> {
    if (!awaitingHuman || hintPending) return;
    const id = gameId;
    const at = moveNo;
    hintPending = true;
    render();
    const decision = await ai.request(observe(game, HUMAN), skillFor(5), settings.thinkMs);
    if (id !== gameId || at !== moveNo) return;
    hintPending = false;
    hint = decision;
    render();
  }

  function moveText(a: number): string {
    const m = decodeAction(a);
    switch (m.type) {
      case 'open':
        return m.cards.map(cardText).join(' ');
      case 'throw':
        return cardText(m.card);
      case 'defend':
        return `${cardText(m.card)} → ${cardText(game.attacks[m.index])}`;
      case 'transfer':
        return `${t.passOn.toLowerCase()} ${cardText(m.card)}`;
      case 'take':
        return `«${t.take}»`;
      case 'pass':
        return `«${game.phase === PILE_ON ? t.enough : t.done}»`;
    }
  }

  function hintLine(): string {
    if (hintPending) return t.hintThinking;
    if (!hint) return '';
    const move = moveText(hint.action);
    if (hint.method === 'forced') return fill(t.hintForced, { move });
    if (hint.method === 'solved') {
      const outcome = hint.outcome === 1 ? t.win : hint.outcome === 0 ? t.draw : t.loss;
      return fill(t.hintSolved, { move, outcome });
    }
    const value = hint.moves?.find((x) => x.action === hint!.action)?.value ?? 0.5;
    return fill(t.hintSearch, { move, pct: Math.round(value * 100) });
  }

  // ---------------------------------------------------------------- rendering

  /** Shows a speech bubble by a seat for long enough to read it. */
  function showBubble(seat: number, text: string): void {
    const bubble = seatEls[seat].querySelector<HTMLElement>('.bubble')!;
    bubble.textContent = text;
    bubble.style.setProperty('--say', `${1400 + text.length * 45}ms`);
    bubble.classList.remove('show');
    void bubble.offsetWidth; // restart the animation
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
    if (settings.avatars !== 'context') return 'neutral';
    if (thinking === seat) return 'thinking';
    return moods[seat].until > performance.now() ? moods[seat].mood : 'neutral';
  };

  /**
   * A computer player responds to something: its face changes and it may say a line.
   * With remarks switched off only the bare announcements of an action remain.
   */
  function react(seat: number, what: Remark, mood?: Mood, moodMs?: number): void {
    if (seat === HUMAN) return;
    if (mood) setMood(seat, mood, moodMs);
    const announces = what === 'take' || what === 'done' || what === 'pass' || what === 'transfer';
    let text = '';
    if (!settings.phrases) text = announces ? plainRemark(what, settings.lang) : '';
    else if (Math.random() < (REMARK_CHANCE[what] ?? 1)) text = remark(who(seat).id, what, settings.lang);
    else if (announces) text = plainRemark(what, settings.lang);
    if (!text) return;
    showBubble(seat, text);
    if (settings.speech) speak(text, who(seat), settings.lang);
  }

  /** The table's reaction to a move: the mover's own line, then anyone it lands on. */
  function comment(seat: number, a: number, next: GameState, id: number): void {
    const move = decodeAction(a);
    const later = (ms: number, fn: () => void): void => {
      setTimeout(() => {
        if (id === gameId) fn();
      }, ms);
    };
    switch (move.type) {
      case 'open':
        react(seat, 'lead');
        break;
      case 'throw':
        react(seat, 'throwIn');
        break;
      case 'defend': {
        const target = game.attacks[move.index];
        const costly = suitOf(move.card) === game.trump && suitOf(target) !== game.trump;
        react(seat, costly ? 'beatTrump' : 'beat');
        break;
      }
      case 'take': {
        react(seat, 'take', game.hands[seat].length + game.attacks.length >= 9 ? 'worried' : 'sad');
        const attacker = game.attacker;
        later(900, () => react(attacker, 'theyTake', 'pleased'));
        break;
      }
      case 'transfer':
        react(seat, 'transfer', 'pleased');
        later(900, () => react(next.defender, 'gotTransfer', 'surprised'));
        break;
      case 'pass':
        if (game.phase === ATTACK) react(seat, seat === game.attacker ? 'done' : 'pass');
        break;
    }
    if (next.deck.length > 0) return;
    if (game.deck.length > 0 && next.phase !== OVER) {
      later(1400, () => react(1 + ((Math.random() * (next.hands.length - 1)) | 0), 'deckOut'));
    }
    // Endgame: someone down to one card, or out of the game altogether.
    for (let p = 1; p < next.hands.length; p++) {
      const before = game.hands[p].length;
      const after = next.hands[p].length;
      if (after === 0 && (before > 0 || game.deck.length > 0)) {
        if (next.phase !== OVER || next.loser !== p) later(700, () => react(p, 'out', 'happy', Infinity));
      } else if (after === 1 && before > 1 && p === seat) {
        later(700, () => react(p, 'lastCard'));
      }
    }
  }

  function buildSeats(): void {
    seatsLayer.innerHTML = '';
    seatEls = [];
    avatarEls = [];
    roleEls = [];
    for (let p = 0; p < game.hands.length; p++) {
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
      el.className = p === HUMAN ? 'seat me' : 'seat';
      el.innerHTML =
        `<span class="name"></span><span class="count"></span><span class="role"></span>` +
        `<span class="dots"><i></i><i></i><i></i></span><span class="bubble"></span>`;
      seatsLayer.appendChild(el);
      seatEls.push(el);
    }
  }

  function render(instant = false): void {
    const rect = stage.getBoundingClientRect();
    const over = game.phase === OVER;
    const layout = computeLayout(game, rect.width, rect.height, {
      human: HUMAN,
      selected,
      revealAll: over,
      showKnown: settings.showKnown,
      avatars: settings.avatars === 'off' ? 'off' : settings.largePortraits ? 'large' : 'normal',
    });
    geo = layout.geo;
    stage.style.setProperty('--cw', `${geo.cw}px`);
    stage.classList.toggle('instant', instant);
    stage.classList.toggle('big-portraits', settings.avatars !== 'off' && settings.largePortraits);

    const legal = awaitingHuman ? legalActions(game, [], true) : [];
    const playable = new Set<Card>();
    const targets = new Set<Card>();
    for (const a of legal) {
      const m = decodeAction(a);
      if (m.type === 'open') m.cards.forEach((c) => playable.add(c));
      else if (m.type !== 'take' && m.type !== 'pass') playable.add(m.card);
      if (m.type === 'defend' && selected.length === 1 && m.card === selected[0]) {
        targets.add(game.attacks[m.index]);
      }
    }
    const hinted = new Set<Card>();
    if (hint && awaitingHuman) {
      const m = decodeAction(hint.action);
      if (m.type === 'open') m.cards.forEach((c) => hinted.add(c));
      else if (m.type !== 'take' && m.type !== 'pass') hinted.add(m.card);
      if (m.type === 'defend') hinted.add(game.attacks[m.index]);
    }

    let drawn = 0;
    for (let c = 0; c < DECK_SIZE; c++) {
      const el = cardEls[c];
      const p = instant
        ? { ...layout.places.get(c)!, x: geo.deck.x, y: geo.deck.y, rot: 0, scale: 1, up: false }
        : layout.places.get(c)!;
      // Cards drawn from the deck leave one after another, after the table has been cleared.
      const delay = !instant && lastWhere[c] === 'deck' && p.where === 'hand' ? 260 + drawn++ * 70 : 0;
      if (!instant) lastWhere[c] = p.where;
      el.style.transitionDelay = `${delay}ms`;
      el.style.transform =
        `translate(${p.x - geo.cw / 2}px, ${p.y - geo.ch / 2}px) rotate(${p.rot}deg) scale(${p.scale})`;
      el.style.zIndex = String(p.z);
      const mine = p.where === 'hand' && p.seat === HUMAN;
      el.classList.toggle('up', p.up);
      // Without the highlight every card in hand looks and lifts alike; the player works out
      // what is legal, and an illegal click is simply refused.
      const canPlay = mine && playable.has(c);
      el.classList.toggle('trump', settings.showTrumps && suitOf(c) === game.trump);
      el.classList.toggle('playable', canPlay);
      el.classList.toggle('liftable', settings.showPlayable ? canPlay : mine && awaitingHuman);
      el.classList.toggle('dim', settings.showPlayable && mine && awaitingHuman && !canPlay);
      el.classList.toggle('selected', selected.includes(c));
      el.classList.toggle('target', targets.has(c));
      el.classList.toggle('hinted', hinted.has(c));
      for (const r of el.querySelectorAll('.rank')) r.textContent = t.ranks[rankOf(c)];
      // Only cards lying face up are named to assistive technology.
      if (p.up) el.setAttribute('aria-label', cardText(c));
      else el.removeAttribute('aria-label');
      if ((mine && playable.has(c)) || targets.has(c)) el.setAttribute('role', 'button');
      else el.removeAttribute('role');
    }

    if (instant) void stage.offsetWidth; // commit the starting positions before animating away

    renderSeats();
    renderAim();
    renderPiles();
    renderActions(legal, over);
    renderBar();
  }

  function renderSeats(): void {
    const over = game.phase === OVER;
    for (let p = 0; p < seatEls.length; p++) {
      const el = seatEls[p];
      const at = geo.seats[p];
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
      const out = isOut(p);
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
          avatar.classList.toggle('active', !over && game.turn === p);
          avatar.classList.toggle('out', out && !over); // at the end everyone is shown in full
          avatar.classList.toggle('fool', over && game.loser === p);
        }
      }
      el.classList.toggle('active', !over && game.turn === p);
      el.classList.toggle('out', out && !(over && game.loser === p));
      el.classList.toggle('fool', over && game.loser === p);
      el.classList.toggle('thinking', thinking === p);
      el.querySelector('.name')!.textContent = seatName(p);
      el.querySelector('.count')!.textContent = p === HUMAN || out ? '' : String(game.hands[p].length);
      // Who leads and who defends. For the player it is part of their plate; for the others
      // it is written above their cards, where it is easier to see.
      const part = out || over ? '' : p === game.defender ? 'defend' : p === game.attacker ? 'attack' : '';
      const mine = p === HUMAN;
      const word =
        part === 'defend' ? (mine ? t.youDefend : t.defends) : part === 'attack' ? (mine ? t.youAttack : t.attacks) : '';
      const plateRole = el.querySelector<HTMLElement>('.role')!;
      plateRole.textContent = out && !over ? (!mine && who(p).female ? t.outShe : t.out) : mine ? word : '';
      plateRole.className = `role${mine && part ? ` ${part}` : ''}`;
      const chip = roleEls[p];
      const where = geo.roles[p];
      if (chip && where) {
        chip.textContent = word;
        chip.className = `role-chip${part ? ` ${part}` : ''}${where.beside ? ' beside' : ''}`;
        chip.style.left = `${where.x}px`;
        chip.style.top = `${where.y}px`;
      }
    }
  }

  /**
   * An arrow on the cloth from whoever is attacking to whoever must defend. It lies under the
   * cards, so with a full table only its two ends show, which is enough to read it.
   */
  function renderAim(): void {
    const path = $('aim-path');
    if (game.phase === OVER || !settings.showArrow) {
      path.style.opacity = '0';
      return;
    }
    const from = geo.aims[game.attacker];
    const to = geo.aims[game.defender];
    // Between two players on the same side the arrow bows towards the middle of the table.
    const sameSide = from.y === to.y;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const bow = sameSide ? 0.55 : 0;
    const cx = midX + (geo.centre.x - midX) * bow;
    const cy = midY + (geo.centre.y - midY) * bow;
    // Stop short of the far end to leave room for the arrowhead.
    const length = Math.hypot(to.x - cx, to.y - cy) || 1;
    const tip = geo.cw * 0.22;
    const endX = to.x - ((to.x - cx) / length) * tip;
    const endY = to.y - ((to.y - cy) / length) * tip;
    const d = `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
    path.setAttribute('d', d);
    path.style.setProperty('d', `path("${d}")`); // lets browsers that can glide between shapes
    path.style.strokeWidth = `${(geo.cw * 0.11).toFixed(1)}px`;
    path.style.opacity = '1';
  }

  function renderPiles(): void {
    const mark = $('trump-mark');
    mark.innerHTML = suitSvg(game.trump);
    mark.className = isRed(game.trump) ? 'red' : 'black';
    mark.style.left = `${geo.deck.x}px`;
    mark.style.top = `${geo.deck.y}px`;
    mark.classList.toggle('bare', game.deck.length === 0);

    const deckLabel = $('deck-count');
    deckLabel.textContent = game.deck.length > 0 ? `${t.deck} · ${game.deck.length}` : '';
    deckLabel.style.left = `${geo.deck.x + geo.cw * 0.2}px`;
    deckLabel.style.top = `${geo.deck.y - geo.ch / 2 - 30}px`;

    const discardLabel = $('discard-label');
    discardLabel.textContent = `${t.discarded} · ${game.discard.length}`;
    discardLabel.hidden = game.discard.length === 0;
    discardLabel.style.left = `${geo.discard.x}px`;
    discardLabel.style.top = `${geo.discard.y - geo.ch / 2 - 30}px`;
  }

  function renderActions(legal: number[], over: boolean): void {
    const actions = $('actions');
    actions.style.top = `${geo.actionY}px`;
    buttonsEl.innerHTML = '';
    const button = (label: string, cls: string, onClick: () => void, glow = false): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = glow ? `${cls} hinted` : cls;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      buttonsEl.appendChild(b);
    };

    let status = '';
    if (over) status = '';
    else if (clearTable) {
      status = t.beaten;
      button(t.clear, 'primary', clearTable);
    } else if (thinking >= 0) status = fill(t.thinking, { name: seatName(thinking) });
    else if (awaitingHuman) {
      const hinting = hint ? decodeAction(hint.action).type : '';
      if (game.phase === DEFEND) {
        const canTransfer = legal.some((a) => decodeAction(a).type === 'transfer');
        status = selected.length ? t.chooseTarget : canTransfer ? t.defendOrTransfer : t.defend;
        const lifted = selected[0];
        const transfer = legal.find((a) => {
          const m = decodeAction(a);
          return m.type === 'transfer' && m.card === lifted;
        });
        if (transfer !== undefined) button(t.passOn, 'primary', () => humanPlay(transfer));
        button(t.take, selected.length ? 'plain' : 'primary', () => humanPlay(TAKE), hinting === 'take');
      } else if (game.attacks.length === 0) {
        status = selected.length ? t.pickMore : t.yourLead;
        if (selected.length) button(t.play, 'primary', playSelection);
      } else {
        const piling = game.phase === PILE_ON;
        status = legal.length === 1 ? t.nothingToAdd : piling ? t.pileOn : t.throwIn;
        button(piling ? t.enough : t.done, 'primary', () => humanPlay(PASS), hinting === 'pass');
      }
      if (settings.hints) button(t.hint, 'plain', () => void askHint());
    }
    // Resigning is kept in the corner, well away from the buttons used on every move.
    const resignButton = $('resign');
    resignButton.hidden = !awaitingHuman || over;
    resignButton.textContent = resignArmed ? t.resignSure : t.resign;
    resignButton.className = resignArmed ? 'plain danger' : 'plain';
    resignButton.style.left = `${geo.resign.x}px`;
    resignButton.style.top = `${geo.resign.y}px`;
    statusEl.textContent = notice || hintLine() || status;
    statusEl.classList.toggle('advice', !notice && (hint !== null || hintPending));
  }

  function renderBar(): void {
    document.documentElement.lang = settings.lang;
    $('meta').innerHTML =
      `<span>${settings.transfer ? t.transfer : t.simple}</span>` +
      `<span class="trump-chip ${isRed(game.trump) ? 'red' : 'black'}">${t.trump} ${suitSvg(game.trump)}</span>`;
    const tally = wholeTally(tallies[tallyKey()]);
    // One on one, every game is a win, a loss or a draw, so the wins follow from the rest
    // even for games played before they were counted. With more players they do not, and
    // the count then says how many games it covers.
    const partial = tally.tracked < tally.games;
    if (partial && settings.opponents.length === 1) {
      tally.wins = tally.games - tally.fools - tally.draws;
    }
    const line = partial && settings.opponents.length > 1 ? t.tallyPartial : t.tally;
    $('score').textContent = tally.games > 0 ? fill(line, { ...tally }) : '';
    $('btn-new').textContent = t.newGame;
    $('btn-settings').textContent = t.settings;
    $('btn-lang').textContent = settings.lang === 'ru' ? 'EN' : 'RU';
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

    // Opponents are picked from the roster, by face or by the stars that show their strength.
    // The order of picking is the order of seating, clockwise from the player's left.
    let picked = [...settings.opponents];
    let shown: 'all' | Character['style'] = 'all';
    const roster = (): string =>
      CHARACTERS.filter((c) => shown === 'all' || c.style === shown)
        .map((c) => {
          const order = picked.indexOf(c.id);
          const rating = ratingOf(c);
          // Each star is a button: the face picks the opponent, the stars set their strength.
          const stars = [1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" data-star="${n}"${n <= rating ? ' class="lit"' : ''} aria-label="${n} / 5">★</button>`,
            )
            .join('');
          const usual = rating === c.rating ? '' : ` custom" title="${t.usually} ${'★'.repeat(c.rating)}`;
          return (
            `<div class="pick${order >= 0 ? ' on' : ''}" data-id="${c.id}">` +
            `<button type="button" class="face" aria-pressed="${order >= 0}">` +
            (settings.avatars !== 'off' ? `<img src="${avatarUrl(c, 'neutral')}" alt="">` : '') +
            `<b>${c.name[settings.lang]}</b></button>` +
            `<span class="stars${usual}">${stars}</span>` +
            (settings.speech ? `<button type="button" class="hear" aria-label="${t.hear}" title="${t.hear}">▶</button>` : '') +
            (order >= 0 ? `<em>${order + 1}</em>` : '') +
            `</div>`
          );
        })
        .join('');

    settingsDialog.innerHTML =
      `<form method="dialog"><h2>${t.setTitle}</h2>` +
      // Two columns where there is room: the game and the opponents, then the switches.
      `<div class="cols"><div class="col">` +
      `<div class="row"><span>${t.setGame}</span>${seg('transfer', [['0', t.simple], ['1', t.transfer]], settings.transfer ? '1' : '0')}</div>` +
      `<div class="row"><span>${t.setOpponents}</span>${seg('shown', [['all', t.all], ['real', t.realistic], ['cartoon', t.cartoon]], shown)}</div>` +
      `<div class="roster"></div><p class="fine">${t.pickHint}</p>` +
      `</div><div class="col">` +
      `<div class="row"><span>${t.setNextLead}</span>${seg('nextLead', [['winner', t.leadWinner], ['fool', t.leadFool]], settings.nextLead)}</div>` +
      `<div class="row"><span>${t.setThink}</span>${seg('thinkMs', [['600', t.fast], ['1500', t.normal], ['4000', t.deep]], String(settings.thinkMs))}</div>` +
      `<div class="row"><span>${t.setAvatars}</span>${seg('avatars', [['off', t.avOff], ['static', t.avStatic], ['context', t.avContext]], settings.avatars)}</div>` +
      check('largePortraits', t.setLarge, settings.largePortraits) +
      check('phrases', t.setPhrases, settings.phrases) +
      check('speech', t.setSpeech, settings.speech) +
      check('firstBoutFive', t.setFive, settings.firstBoutFive) +
      check('showKnown', t.setKnown, settings.showKnown) +
      check('autoDiscard', t.setAutoDiscard, settings.autoDiscard) +
      check('hints', t.setHints, settings.hints) +
      check('showPlayable', t.setPlayable, settings.showPlayable) +
      check('showTrumps', t.setTrumps, settings.showTrumps) +
      check('showArrow', t.setArrow, settings.showArrow) +
      check('trumpCount', t.setTrumpCount, settings.trumpCount) +
      `</div></div>` +
      `<p class="fine">${t.fairness}</p>` +
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
        // A sample of the voice: one of their greetings.
        const c = characterById(id);
        void audition(remark(c.id, 'greet', settings.lang), c, settings.lang);
        return;
      }
      if (star) {
        // A strength of the player's choosing; picking the usual one clears the choice.
        const ratings = { ...settings.ratings, [id]: Number(star) as Rating };
        if (ratings[id] === characterById(id).rating) delete ratings[id];
        apply({ ratings });
      } else if (!target.closest('.face')) {
        return;
      } else if (picked.includes(id)) {
        if (picked.length > 1) picked = picked.filter((x) => x !== id); // someone has to play
      } else {
        picked = [...picked, id].slice(-3); // a fourth pick replaces the first
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
      save('durak.tally', tallies);
      renderBar();
    });
    // These only change what is shown or heard, so they take effect at once, mid-game included.
    const apply = (change: Partial<Settings>): void => {
      settings = { ...settings, ...change };
      if (!settings.hints) hint = null;
      // Voice clips are fetched only while speech is on.
      if ('speech' in change) {
        if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
        else releaseVoices();
      }
      save('durak.settings', settings);
      render();
    };
    const boxes = ['largePortraits', 'phrases', 'speech', 'showKnown', 'autoDiscard', 'hints', 'showPlayable', 'showTrumps', 'showArrow', 'trumpCount'] as const;
    for (const name of boxes) {
      const box = form.querySelector<HTMLInputElement>(`[name=${name}]`)!;
      box.addEventListener('change', () => {
        apply({ [name]: box.checked });
        if (name === 'speech') rosterEl.innerHTML = roster(); // the "hear" buttons come and go
      });
    }
    for (const radio of form.querySelectorAll<HTMLInputElement>('[name=avatars]')) {
      radio.addEventListener('change', () => {
        apply({ avatars: radio.value as AvatarMode });
        rosterEl.innerHTML = roster();
      });
    }
    form.addEventListener('submit', () => {
      const data = new FormData(form);
      // A different line-up starts afresh: nobody has won or lost against it yet.
      if (picked.join() !== settings.opponents.join()) {
        lastWinner = undefined;
        lastFool = undefined;
      }
      settings = {
        ...settings,
        opponents: picked,
        nextLead: data.get('nextLead') === 'fool' ? 'fool' : 'winner',
        transfer: data.get('transfer') === '1',
        thinkMs: Number(data.get('thinkMs')),
        firstBoutFive: data.has('firstBoutFive'),
      };
      save('durak.settings', settings);
      deal();
    });
    settingsDialog.showModal();
  }

  function openDiscard(): void {
    const rows = [0, 1, 2, 3]
      .map((suit) => {
        const cards = game.discard
          .filter((c) => suitOf(c) === suit)
          .sort((a, b) => a - b)
          .map((c) => `<b>${t.ranks[rankOf(c)]}</b>`)
          .join('');
        return `<div class="suit-row ${isRed(suit) ? 'red' : 'black'}">${suitSvg(suit)}${cards || '<i>—</i>'}</div>`;
      })
      .join('');
    discardDialog.innerHTML =
      `<form method="dialog"><h2>${t.discardTitle}</h2>` +
      (game.discard.length ? rows : `<p class="fine">${t.none}</p>`) +
      `<div class="buttons"><button class="primary">${t.close}</button></div></form>`;
    discardDialog.showModal();
  }

  $('btn-new').addEventListener('click', deal);
  $('btn-settings').addEventListener('click', openSettings);
  $('resign').addEventListener('click', (e) => {
    e.stopPropagation();
    resign();
  });
  $('btn-lang').addEventListener('click', () => {
    settings = { ...settings, lang: settings.lang === 'ru' ? 'en' : 'ru' };
    t = STRINGS[settings.lang];
    save('durak.settings', settings);
    if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
    render();
  });
  $('discard-label').addEventListener('click', (e) => {
    e.stopPropagation();
    openDiscard();
  });
  stage.addEventListener('click', () => {
    if (selected.length > 0) {
      selected = [];
      notice = '';
      render();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (document.querySelector('dialog[open]')) return;
    const primary = (resultEl.hidden ? buttonsEl : resultEl).querySelector<HTMLButtonElement>('.primary');
    if (primary) {
      e.preventDefault();
      primary.click();
    }
  });
  new ResizeObserver(() => {
    if (game) render();
  }).observe(stage);

  const firstVisit = load<Partial<Settings>>('durak.settings', {}).opponents === undefined;
  deal();
  if (firstVisit) openSettings();
}
