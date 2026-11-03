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
import { TELLERS, tellerById, tellerPicture } from '../fortune/tellers';
import { PAGES, otherLangs } from '../seo';
import { AiClient } from './aiClient';
import { createCard, isRed, suitSvg } from './cardView';
import { CHARACTERS, Character, Mood, characterById } from './characters';
import { playClip } from './clip';
import { playSmoke } from './smoke';
import { Lang, STRINGS, Strings, fill } from './i18n';
import { Geometry, Place, computeLayout } from './layout';
import { REMARK_CHANCE, Remark, plainRemark, remark } from './phrases';
import { pickPicture, portraitUrl, preloadAvatars, viewsOf } from './portraits';
import { PAGE_LANG, PART_ROOT, ROOT, browserLang } from './root';
import { audition, prepareVoices, releaseVoices, speak, stopSpeaking } from './speech';
import { load, save } from './store';

const HUMAN = 0;
const BOT_PAUSE = 700; // a computer move is never shown sooner than this
const SWAP_MS = 200; // how long one picture of a portrait takes to turn into the next
const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

type AvatarMode = 'static' | 'context';

interface Settings {
  opponents: string[]; // character ids, clockwise from the player's left; one to three
  ratings: Record<string, Rating>; // strength chosen for a character in place of their usual one
  views: Record<string, string>; // the view shown of a character who has two, such as 'sonya/2'
  transfer: boolean;
  firstBoutFive: boolean;
  // Who leads every game after the first: the previous winner, or the player to the fool's
  // right, leading at the fool.
  nextLead: 'winner' | 'fool';
  thinkMs: number;
  portraits: boolean; // a portrait beside each opponent's cards, large where there is room
  avatars: AvatarMode; // one fixed picture, or pictures that follow the game
  stats: boolean; // each player's results against the current line-up, beside them
  phrases: boolean; // opponents make remarks in their own voice
  speech: boolean; // remarks are also read aloud
  showKnown: boolean;
  autoDiscard: boolean; // sweep a beaten bout away without waiting for the player
  hints: boolean; // offer the Hint button
  showArrow: boolean; // draw the arrow from the attacker to the defender
  trumpCount: boolean; // after a game, say how many trumps each player received
  showPlayable: boolean; // dim the cards that cannot be played now
  showTrumps: boolean; // mark trump cards with a brass band
  undo: boolean; // a move can be taken back (Ctrl+Z)
  chance: boolean; // the player's chance of not ending up the fool is always on show
  gameLog: boolean; // every move is written down in a log beside the table
  openCards: boolean; // the opponents' hands lie face up
  // The training options above take effect only while this is on, so the game can be played
  // straight and the chosen aids come back with one switch.
  training: boolean;
  lang: Lang;
}

/** The options that help in learning the game. */
type Aid = 'showKnown' | 'showPlayable' | 'showTrumps' | 'hints' | 'chance' | 'undo' | 'gameLog' | 'openCards';

/** How one player's games ended. Every game ends one of four ways, so the four add up. */
interface Score {
  wins: number; // first to get out
  losses: number; // left as the fool, or gave up
  draws: number; // one of the last two, who went out together
  outs: number; // got out, though not first
}

/** The games played against one line-up, and how each player at the table fared in them. */
interface Tally {
  games: number;
  scores: Record<string, Score>; // by character id, and 'you' for the player
}

const NO_SCORE: Score = { wins: 0, losses: 0, draws: 0, outs: 0 };
const NO_TALLY: Tally = { games: 0, scores: {} };

/** The game as it stood when the player was to move, to go back to with "Take back". */
interface Snapshot {
  game: GameState;
  firstOut: number | undefined;
  left: boolean[];
  trumpsDrawn: number[];
  logLength: number;
}

const DEFAULTS: Settings = {
  opponents: ['lev'],
  ratings: {},
  views: {},
  transfer: false,
  firstBoutFive: true,
  nextLead: 'fool',
  thinkMs: 4000,
  portraits: true,
  avatars: 'context',
  stats: false,
  phrases: true,
  speech: false,
  showKnown: false,
  autoDiscard: true,
  hints: false,
  showArrow: false,
  trumpCount: false,
  showPlayable: true,
  showTrumps: false,
  undo: false,
  chance: false,
  gameLog: false,
  openCards: false,
  training: true,
  lang: browserLang(),
};

const $ =<T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
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
  const aboutDialog = $<HTMLDialogElement>('about');
  let aboutLang: Lang | undefined; // the language the About text was last written in
  const tellerLink = $<HTMLAnchorElement>('teller');
  // The fortune-teller in the corner: the one last chosen on the fortune-telling page, or one of
  // them at random for someone who has not been there.
  const caller = tellerById(
    load<{ teller?: string }>('fortune.settings', {}).teller ?? TELLERS[(Math.random() * TELLERS.length) | 0].id,
  );

  const ai = new AiClient();
  // A second worker weighs the player's position, for hints and the chance on show, so the
  // computer players never wait for it.
  const analyst = new AiClient();
  let settings = load('durak.settings', DEFAULTS);
  // Stored choices may predate the roster or name someone no longer in it.
  const known = settings.opponents.filter((id) => CHARACTERS.some((c) => c.id === id)).slice(0, 3);
  settings = { ...settings, opponents: known.length > 0 ? known : DEFAULTS.opponents };
  // Portraits used to be switched off as one of their kinds.
  if ((settings.avatars as string) === 'off') settings = { ...settings, portraits: false, avatars: 'context' };
  // A page in one language is in that language, whatever was chosen before.
  if (PAGE_LANG) settings = { ...settings, lang: PAGE_LANG };
  // The counters last for the browser session, or until they are reset in Settings.
  const session = (): Storage => sessionStorage;
  let tallies = load<Record<string, Tally>>('durak.scores', {}, session);
  let t: Strings = STRINGS[settings.lang];

  let game: GameState;
  let gameId = 0; // bumped on every new deal so stale replies and timers are ignored
  let moveNo = 0;
  let awaitingHuman = false;
  let thinking = -1;
  let selected: Card[] = [];
  let notice = '';
  // The program's view of the player's current turn: worked out on request, or at once when the
  // chance is on show. The suggested move itself is shown only after "Hint" is pressed.
  let advice: AiDecision | null = null;
  let advising: Promise<AiDecision | null> | null = null;
  let showHint = false;
  let chance = ''; // the latest chance, kept on show while the others move
  let snapshots: Snapshot[] = []; // one for each of the player's turns this game
  let logLines: string[] = []; // the game log, as HTML
  let logShown = 0; // how many of its lines are on screen
  // Who got out before the game ended. One who goes out in the very bout that ends the game in
  // a draw is one of those who drew.
  let left: boolean[] = [];
  let resigned = false; // the human gave the game up
  let moved = false; // the human has made a move in this game
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
  let statEls: HTMLElement[] = []; // each player's results, when they are on show
  let fanEnds: number[] = []; // right edge of each opponent's cards, as last laid out
  // What each seat's face shows for the moment, in "react to the game" mode.
  let moods: { mood: Mood; until: number }[] = [];
  // The mood each seat's picture is showing, and the picture it last showed for each mood.
  let faces: { mood: Mood | null; shown: Partial<Record<Mood, string>> }[] = [];
  let lastNudge = -Infinity; // when an opponent last remarked on the player taking their time
  let jokeSeat = -1; // the seat whose portrait is playing its clip, or smoking its pipe
  let stopJoke = (): void => {};

  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < DECK_SIZE; c++) {
    const el = createCard(c);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onCardClick(c);
    });
    cardEls.push(el);
    cardsLayer.appendChild(el);
  }

  const cardText = (c: Card): string => t.ranks[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
  /** Whether a training option is in effect: chosen, and training switched on. */
  const aid = (name: Aid): boolean => settings.training && settings[name];
  const isOut = (p: number): boolean => game.hands[p].length === 0 && game.deck.length === 0;
  /** The character in an opponent's seat (seats 1 and up). */
  const who = (seat: number): Character => characterById(settings.opponents[seat - 1]);
  /** The view a character is shown in: the one the player last switched to, else their own. */
  const viewOf = (c: Character): string =>
    viewsOf(c).includes(settings.views[c.id] ?? '') ? settings.views[c.id]! : c.id;
  /** How strongly a character plays: the player's choice if they made one, else their usual. */
  const ratingOf = (c: Character): Rating => {
    const chosen = settings.ratings[c.id];
    return chosen >= 1 && chosen <= 5 ? chosen : c.rating;
  };
  // Results are kept apart for each line-up and each strength it was played at.
  const tallyKey = (): string =>
    `${settings.transfer ? 't' : 's'}:` +
    settings.opponents.map((id) => id + ratingOf(characterById(id))).join('+');
  const scoreId = (seat: number): string => (seat === HUMAN ? 'you' : who(seat).id);
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
    dropAdvice();
    chance = '';
    snapshots = [];
    logLines = [fill(t.logDeal, { card: cardHtml(game.trumpCard) })];
    logShown = 0;
    left = game.hands.map(() => false);
    resigned = false;
    moved = false;
    resignArmed = false;
    resultEl.hidden = true;
    moods = Array.from({ length: n }, () => ({ mood: 'neutral' as Mood, until: 0 }));
    faces = Array.from({ length: n }, () => ({ mood: null, shown: {} }));
    stopSpeaking();
    if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
    if (settings.portraits) {
      for (const c of settings.opponents.map(characterById)) viewsOf(c).forEach((view) => preloadAvatars(c, view));
    }
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
        snapshots.push({
          game: cloneState(game),
          firstOut,
          left: left.slice(),
          trumpsDrawn: trumpsDrawn.slice(),
          logLength: logLines.length,
        });
        if (aid('chance')) void analyse();
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
    dropAdvice();
    const before = game;
    const next = cloneState(game);
    applyAction(next, a);
    logMove(seat, a, before, next);
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
    // A portrait that goes on thinking takes a new thinking picture with each of its moves.
    if (faces[seat]!.mood === 'thinking') faces[seat]!.mood = null;
    game = next;
    if (firstOut === undefined) {
      // Hands empty one move at a time, so this is whoever just played their last card.
      firstOut = [seat, ...game.hands.keys()].find((p) => isOut(p));
    }
    // A player has left the game once a new bout begins without them.
    if (game.phase !== OVER && game.attacks.length === 0) {
      game.hands.forEach((_, p) => {
        if (isOut(p)) left[p] = true;
      });
    }
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
      for (const seat of waiting) startJoke(seat);
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
    dropAdvice();
    moveNo++;
    game = { ...cloneState(game), phase: OVER, loser: HUMAN };
    finish();
  }

  /** Lets the server count a game: asking for an empty file is enough, as its log keeps the address. */
  function reportGame(event: 'played' | 'ended'): void {
    const url = `${ROOT}game.txt?e=${event}&o=${settings.opponents.join(',')}`;
    void fetch(url, { cache: 'no-store', keepalive: true }).catch(() => undefined);
  }

  function humanPlay(a: number): void {
    if (!awaitingHuman) return;
    awaitingHuman = false;
    resignArmed = false;
    selected = [];
    notice = '';
    if (!moved) reportGame('played');
    moved = true;
    const id = gameId;
    void play(a, id).then(() => {
      if (id === gameId) void run(id);
    });
  }

  function finish(): void {
    // The winner leads the next game. After a resignation with nobody out yet, the only
    // possible winner is the lone opponent of a two-player game.
    lastWinner = firstOut ?? (resigned && game.hands.length === 2 ? 1 : undefined);
    lastFool = game.loser >= 0 ? game.loser : undefined;
    const key = tallyKey();
    const tally = { ...NO_TALLY, ...tallies[key] };
    const scores = { ...tally.scores };
    game.hands.forEach((_, p) => {
      // A draw between two others, after this player had left, is not this player's draw.
      const how: keyof Score =
        game.loser === p ? 'losses' : game.loser === DRAW && !left[p] ? 'draws' : lastWinner === p ? 'wins' : 'outs';
      const id = scoreId(p);
      scores[id] = { ...NO_SCORE, ...scores[id], [how]: (scores[id]?.[how] ?? 0) + 1 };
    });
    tallies = { ...tallies, [key]: { games: tally.games + 1, scores } };
    save('durak.scores', tallies, session);
    if (moved) reportGame('ended');

    let text: string;
    if (resigned) text = t.youResigned;
    else if (game.loser === HUMAN) text = t.youFool;
    else if (game.loser === DRAW) text = left[HUMAN] ? t.othersDraw : t.youDraw;
    else text = fill(t.youWon, { name: seatName(game.loser) });
    // The fool takes it badly; if that is the player, the others are pleased and one says so.
    if (game.loser > HUMAN) react(game.loser, 'fool', 'angry', Infinity);
    if (game.loser === HUMAN) {
      for (let p = 1; p < game.hands.length; p++) setMood(p, 'happy', Infinity);
      react(1 + ((Math.random() * (game.hands.length - 1)) | 0), 'youFool');
    }
    logLines.push(text);
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

  /** Puts the lifted cards back: by the Cancel button, the Esc key or a click on the cloth. */
  function cancelSelection(): void {
    if (selected.length === 0) return;
    selected = [];
    notice = '';
    render();
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

  /** Forgets the view of a turn that is over, and stops working one out. */
  function dropAdvice(): void {
    analyst.cancel();
    advice = null;
    advising = null;
    showHint = false;
  }

  /** Weighs the player's position, once per turn, as the strongest computer player would. */
  function analyse(): Promise<AiDecision | null> {
    if (advising) return advising;
    const id = gameId;
    const at = moveNo;
    const obs = observe(game, HUMAN);
    // Playing with open cards, the player knows every hand, and so does the advice.
    if (aid('openCards')) obs.known = game.hands.map((h) => h.slice());
    advising = analyst.request(obs, skillFor(5), settings.thinkMs, true).then((d) => {
      if (id !== gameId || at !== moveNo) return null;
      advice = d;
      chance = chanceText(d);
      render();
      return d;
    });
    return advising;
  }

  function askHint(): void {
    if (!awaitingHuman) return;
    showHint = true;
    render();
    void analyse();
  }

  /** The chance in a word or two, for the player's plate. */
  function chanceText(d: AiDecision): string {
    if (d.method === 'solved' && d.outcome !== undefined) {
      const outcome = d.outcome === 1 ? t.win : d.outcome === 0 ? t.draw : t.lossShort;
      return fill(t.chanceSolved, { outcome });
    }
    const value = d.moves?.find((x) => x.action === d.action)?.value ?? 0.5;
    return fill(t.chance, { pct: Math.round(value * 100) });
  }

  /**
   * Takes the player's last move back, with everything the others did after it. While the
   * others are still moving, it returns to the turn the player has just played.
   */
  function undo(): void {
    if (!aid('undo') || game.phase === OVER) return;
    const depth = awaitingHuman ? 2 : 1;
    if (snapshots.length < depth) return;
    if (awaitingHuman) snapshots.pop(); // the turn waiting now
    const back = snapshots.pop()!; // pushed again when that turn comes round
    const id = ++gameId; // moves under way and their timers are dropped
    ai.cancel();
    dropAdvice();
    clearTable?.();
    clearTable = null;
    stopSpeaking();
    game = cloneState(back.game);
    firstOut = back.firstOut;
    left = back.left.slice();
    trumpsDrawn = back.trumpsDrawn.slice();
    logLines.length = back.logLength;
    logLines.push(t.logUndo);
    logShown = 0;
    moveNo++;
    awaitingHuman = false;
    thinking = -1;
    selected = [];
    notice = '';
    resignArmed = false;
    void run(id);
  }

  const cardHtml = (c: Card): string =>
    `<span class="${isRed(suitOf(c)) ? 'red' : 'black'}">${cardText(c)}</span>`;

  /** Writes a move into the log, and how the bout ended if the move ended it. */
  function logMove(seat: number, a: number, before: GameState, next: GameState): void {
    const m = decodeAction(a);
    const who = seatName(seat);
    const form = (pair: string[]): string => pair[seat === HUMAN ? 1 : 0];
    let line = '';
    if (m.type === 'open') line = fill(form(t.logLead), { who, cards: m.cards.map(cardHtml).join(' ') });
    else if (m.type === 'throw') line = fill(form(t.logThrow), { who, cards: cardHtml(m.card) });
    else if (m.type === 'defend') {
      line = fill(form(t.logBeat), { who, target: cardHtml(before.attacks[m.index]), cards: cardHtml(m.card) });
    } else if (m.type === 'transfer') line = fill(form(t.logTransfer), { who, cards: cardHtml(m.card) });
    else if (m.type === 'take') line = fill(form(t.logTake), { who });
    if (line) logLines.push(line);

    // The bout is over once the table is bare again.
    const onTable = (s: GameState): number => s.attacks.length + s.defenses.filter((d) => d >= 0).length;
    if (onTable(next) === 0 && (onTable(before) > 0 || m.type === 'open')) {
      const swept = next.discard.length - before.discard.length;
      if (swept > 0) logLines.push(fill(t.logBeaten, { n: swept }));
      else {
        const n = onTable(before) + (m.type === 'throw' || m.type === 'defend' ? 1 : 0);
        const taker = before.defender;
        logLines.push(fill(t.logTook[taker === HUMAN ? 1 : 0], { who: seatName(taker), n }));
      }
    }
    for (let p = 0; p < next.hands.length; p++) {
      const wasIn = before.hands[p].length > 0 || before.deck.length > 0;
      const isOutNow = next.hands[p].length === 0 && next.deck.length === 0;
      if (wasIn && isOutNow && next.phase !== OVER) {
        logLines.push(fill(t.logOut[p === HUMAN ? 1 : 0], { who: seatName(p) }));
      }
    }
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
    if (!showHint) return '';
    if (!advice) return t.hintThinking;
    const move = moveText(advice.action);
    if (legalActions(game).length === 1) return fill(t.hintForced, { move });
    if (advice.method === 'solved') {
      const outcome = advice.outcome === 1 ? t.win : advice.outcome === 0 ? t.draw : t.loss;
      return fill(t.hintSolved, { move, outcome });
    }
    const value = advice.moves?.find((x) => x.action === advice!.action)?.value ?? 0.5;
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
    if (!settings.portraits || settings.avatars !== 'context') return 'neutral';
    if (thinking === seat) return 'thinking';
    if (moods[seat].until > performance.now()) return moods[seat].mood;
    // Whoever leads or defends stays thoughtful until the lead ends, instead of blinking.
    const inBout = game.attacks.length > 0 && (seat === game.attacker || seat === game.defender);
    return inBout ? 'thinking' : 'neutral';
  };

  /** A seat's picture for its mood: picked when the mood begins, and kept until it ends. */
  function faceOf(seat: number): string {
    const face = faces[seat]!;
    const mood = moodOf(seat);
    if (face.mood !== mood) {
      face.mood = mood;
      face.shown[mood] = pickPicture(who(seat), mood, face.shown[mood], viewOf(who(seat)));
    }
    return face.shown[mood]!;
  }

  /**
   * A portrait may play its joke, a clip or a pipe, while it moves with the game and the seat has
   * nothing to do.
   */
  const jokeAllowed = (seat: number): boolean =>
    settings.portraits &&
    settings.avatars === 'context' &&
    game.phase !== OVER &&
    game.turn !== seat &&
    !reducedMotion();

  function startJoke(seat: number): void {
    const c = who(seat);
    if (!(c.clip || c.smoke) || jokeSeat >= 0 || !jokeAllowed(seat)) return;
    jokeSeat = seat;
    const avatar = avatarEls[seat]!;
    stopJoke = (c.clip ? playClip : playSmoke)(
      avatar,
      c,
      (src) => changePicture(avatar, src),
      () => {
        if (jokeSeat !== seat) return; // the seats have been rebuilt
        jokeSeat = -1;
        renderSeats();
      },
    );
  }

  /**
   * A character seen two ways, up close and at the table, turns to their other view when their
   * portrait is clicked. The view they are left in is kept for the games after.
   */
  function switchView(seat: number): void {
    const c = who(seat);
    const views = viewsOf(c);
    const view = views[(views.indexOf(viewOf(c)) + 1) % views.length]!;
    settings = { ...settings, views: { ...settings.views, [c.id]: view } };
    save('durak.settings', settings);
    faces[seat] = { mood: null, shown: {} };
    renderSeats();
  }

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
    jokeSeat = -1;
    stopJoke();
    seatsLayer.innerHTML = '';
    seatEls = [];
    avatarEls = [];
    roleEls = [];
    statEls = [];
    for (let p = 0; p < game.hands.length; p++) {
      let avatar: HTMLImageElement | null = null;
      let role: HTMLElement | null = null;
      if (p !== HUMAN) {
        avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.alt = '';
        avatar.draggable = false;
        if (who(p).clip || who(p).smoke) {
          avatar.classList.add('has-joke');
          avatar.addEventListener('mouseenter', () => startJoke(p));
        }
        if (viewsOf(who(p)).length > 1) {
          avatar.classList.add('has-views');
          avatar.addEventListener('click', (e) => {
            e.stopPropagation(); // not a click on the table, which would let go of the chosen cards
            switchView(p);
          });
        }
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
        `<span class="name"></span><span class="count"></span><span class="role"></span><span class="chance"></span>` +
        `<span class="dots"><i></i><i></i><i></i></span><span class="bubble"></span>`;
      seatsLayer.appendChild(el);
      seatEls.push(el);
      const stats = document.createElement('div');
      stats.className = 'stats';
      seatsLayer.appendChild(stats);
      statEls.push(stats);
    }
  }

  function render(instant = false): void {
    const rect = stage.getBoundingClientRect();
    const over = game.phase === OVER;
    const lay = (avatars: 'off' | 'normal' | 'large') =>
      computeLayout(game, rect.width, rect.height, {
        human: HUMAN,
        selected,
        revealAll: over || aid('openCards'),
        showKnown: aid('showKnown'),
        avatars,
      });
    // Portraits are large, unless that would leave the table too little room for a bout.
    let layout = lay(settings.portraits ? 'large' : 'off');
    const large = settings.portraits && layout.geo.tableRoom >= layout.geo.ch * 1.7;
    if (settings.portraits && !large) layout = lay('normal');
    geo = layout.geo;
    fanEnds = game.hands.map(() => 0);
    let handLeft = Infinity; // the left edge of the player's hand
    for (const place of layout.places.values()) {
      if (place.where === 'hand' && place.seat !== HUMAN) {
        fanEnds[place.seat] = Math.max(fanEnds[place.seat], place.x + (geo.cw * place.scale) / 2);
      } else if (place.where === 'hand') {
        handLeft = Math.min(handLeft, place.x - geo.cw / 2);
      }
    }
    // The fortune-teller in the corner steps aside when the hand grows into her corner.
    tellerLink.classList.toggle('away', handLeft < tellerLink.offsetLeft + tellerLink.offsetWidth + 10);
    stage.style.setProperty('--cw', `${geo.cw}px`);
    stage.classList.toggle('instant', instant);
    stage.classList.toggle('big-portraits', large);

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
    if (showHint && advice && awaitingHuman) {
      const m = decodeAction(advice.action);
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
      // The wait applies to the turn as well as the move, so that a card bound for the
      // player's hand leaves the deck face down and turns over on the way.
      const delay = !instant && lastWhere[c] === 'deck' && p.where === 'hand' ? 260 + drawn++ * 70 : 0;
      if (!instant) lastWhere[c] = p.where;
      el.style.setProperty('--wait', `${delay}ms`);
      el.style.transform =
        `translate(${p.x - geo.cw / 2}px, ${p.y - geo.ch / 2}px) rotate(${p.rot}deg) scale(${p.scale})`;
      el.style.zIndex = String(p.z);
      const mine = p.where === 'hand' && p.seat === HUMAN;
      el.classList.toggle('up', p.up);
      // Without the highlight every card in hand looks and lifts alike; the player works out
      // what is legal, and an illegal click is simply refused.
      const canPlay = mine && playable.has(c);
      el.classList.toggle('trump', aid('showTrumps') && suitOf(c) === game.trump);
      el.classList.toggle('playable', canPlay);
      el.classList.toggle('liftable', aid('showPlayable') ? canPlay : mine && awaitingHuman);
      el.classList.toggle('dim', aid('showPlayable') && mine && awaitingHuman && !canPlay);
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
    renderLog();
  }

  function renderLog(): void {
    const panel = $('log');
    panel.hidden = !aid('gameLog');
    document.body.classList.toggle('log-open', !panel.hidden);
    $('log-title').textContent = t.logTitle;
    if (panel.hidden || logShown === logLines.length) return;
    const list = $('log-lines');
    list.innerHTML = logLines.map((line) => `<li>${line}</li>`).join('');
    logShown = logLines.length;
    list.scrollTop = list.scrollHeight;
  }

  /** Changes a portrait's picture by dissolving, with the old picture left on top to fade away. */
  function changePicture(avatar: HTMLImageElement, src: string): void {
    if (avatar.hasAttribute('src') && !reducedMotion()) {
      const old = avatar.cloneNode() as HTMLImageElement;
      old.classList.add('fading');
      avatar.after(old);
      const fade = old.animate({ opacity: 0 }, { duration: SWAP_MS, easing: 'ease-in-out', fill: 'forwards' });
      fade.onfinish = () => old.remove();
    }
    avatar.src = src;
  }

  function renderSeats(): void {
    const over = game.phase === OVER;
    if (jokeSeat >= 0 && !jokeAllowed(jokeSeat)) stopJoke();
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
          if (jokeSeat !== p) {
            const src = faceOf(p);
            if (avatar.getAttribute('src') !== src) changePicture(avatar, src);
          }
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
      // A defender who has given up is no longer defending: the label says they are picking up.
      const taking = part === 'defend' && game.phase === PILE_ON;
      const word = taking
        ? mine ? t.youTake : t.takes
        : part === 'defend' ? (mine ? t.youDefend : t.defends) : part === 'attack' ? (mine ? t.youAttack : t.attacks) : '';
      const plateRole = el.querySelector<HTMLElement>('.role')!;
      plateRole.textContent = out && !over ? (!mine && who(p).female ? t.outShe : t.out) : mine ? word : '';
      plateRole.className = `role${mine && part ? ` ${part}` : ''}`;
      if (mine) {
        // The chance stays on show while the others move, faded until the player's next turn.
        const chanceEl = el.querySelector<HTMLElement>('.chance')!;
        const on = aid('chance') && !over && !out;
        chanceEl.textContent = on ? chance || (awaitingHuman ? fill(t.chance, { pct: '…' }) : '') : '';
        chanceEl.title = t.chanceTitle;
        chanceEl.classList.toggle('stale', !awaitingHuman || !advice);
      }
      renderStats(p);
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
   * A player's results against this line-up: to the left of an opponent's portrait where
   * there is room before the neighbour's cards, otherwise under their name plate; beside the
   * player's own plate.
   */
  function renderStats(p: number): void {
    const el = statEls[p];
    const tally = tallies[tallyKey()];
    if (!settings.stats || !tally || tally.games === 0) {
      el.hidden = true;
      return;
    }
    const score = { ...NO_SCORE, ...tally.scores[scoreId(p)] };
    // One on one there is no getting out without being first.
    const parts: [keyof Score, string][] = [['wins', t.statWins], ['losses', t.statLosses]];
    if (game.hands.length > 2) parts.push(['outs', t.statOuts]);
    parts.push(['draws', t.statDraws]);
    el.innerHTML = parts.map(([k, label]) => `<span><b>${score[k]}</b> ${label}</span>`).join('');
    el.hidden = false;
    const W = stage.clientWidth;
    const spot = geo.avatars[p];
    let x: number;
    let y: number;
    let kind: string;
    let room: number; // widest the line may be before it wraps
    if (p === HUMAN) {
      x = geo.seats[p].x + seatEls[p].offsetWidth + 10;
      y = geo.seats[p].y;
      kind = 'mine';
      room = W - x - 8;
    } else if (spot && spot.x - spot.size / 2 - (p > 1 ? fanEnds[p - 1] : 0) >= 92) {
      x = spot.x - spot.size / 2 - 8;
      y = spot.y - spot.size / 2 + 2;
      kind = 'side';
      room = x - (p > 1 ? fanEnds[p - 1] : 0) - 4;
    } else {
      x = geo.seats[p].x;
      y = geo.seats[p].y + 34;
      kind = 'under';
      room = W / Math.max(1, game.hands.length - 1) - 10;
    }
    el.className = `stats ${kind}`;
    el.style.maxWidth = `${Math.max(80, room)}px`;
    if (kind === 'under') {
      // Centred under the plate, but kept on the screen.
      const half = el.offsetWidth / 2;
      x = Math.min(Math.max(x, half + 4), W - half - 4);
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
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
    // Looking through the discard is part of the memory aid; without it the pile stays shut.
    $<HTMLButtonElement>('discard-label').disabled = !aid('showKnown');
    discardLabel.style.left = `${geo.discard.x}px`;
    discardLabel.style.top = `${geo.discard.y}px`;
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
      const hinting = showHint && advice ? decodeAction(advice.action).type : '';
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
      // Cards that have been lifted can always be put back.
      if (selected.length) button(t.cancel, 'plain', cancelSelection);
      if (aid('hints')) button(t.hint, 'plain', askHint);
    }
    // Resigning is kept in the corner, well away from the buttons used on every move.
    const resignButton = $('resign');
    resignButton.hidden = !awaitingHuman || over;
    resignButton.textContent = resignArmed ? t.resignSure : t.resign;
    resignButton.className = resignArmed ? 'plain danger' : 'plain';
    resignButton.style.left = `${geo.resign.x}px`;
    resignButton.style.top = `${geo.resign.y}px`;
    statusEl.textContent = notice || hintLine() || status;
    statusEl.classList.toggle('advice', !notice && showHint);
  }

  function renderBar(): void {
    document.documentElement.lang = settings.lang;
    document.title = PAGES[settings.lang].title;
    $('brand').textContent = t.title;
    $('meta').innerHTML =
      `<span>${settings.transfer ? t.transfer : t.simple}</span>` +
      `<span class="trump-chip ${isRed(game.trump) ? 'red' : 'black'}">${t.trump} ${suitSvg(game.trump)}</span>`;
    const games = tallies[tallyKey()]?.games ?? 0;
    $('score').textContent = games > 0 ? fill(t.tally, { games }) : '';
    $('btn-new').textContent = t.newGame;
    $('btn-settings').textContent = t.settings;
    $('btn-about').firstElementChild!.textContent = t.about;
    $('btn-about').setAttribute('aria-label', t.about);
    tellerLink.href = `${ROOT}fortune/${settings.lang}/`;
    tellerLink.setAttribute('aria-label', `${t.fortune}: ${caller.name[settings.lang]}`);
    if (aboutLang !== settings.lang) {
      aboutLang = settings.lang;
      // The switch is made of real links to the pages in the other languages, for search
      // engines and for opening in a new tab; an ordinary click switches in place (see below).
      $('langs').innerHTML = otherLangs(settings.lang)
        .map((l) => `<a class="ghost" href="${PART_ROOT}${l}/" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`)
        .join('');
      $('about-body').innerHTML = PAGES[settings.lang].about;
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
      `<label class="check"><input type="checkbox" name="${name}"${on ? ' checked' : ''}>` +
      `<span>${label}</span></label>`;

    // Opponents are picked from the roster, by face or by the stars that show their strength.
    // The order of picking is the order of seating, clockwise from the player's left.
    // The roster opens on the group of whoever sits first.
    let picked = [...settings.opponents];
    let shown = characterById(picked[0]).style;
    const roster = (): string =>
      CHARACTERS.filter((c) => c.style === shown)
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
            (settings.portraits ? `<img src="${portraitUrl(c)}" alt="">` : '') +
            `<b>${c.name[settings.lang]}</b></button>` +
            `<span class="stars${usual}">${stars}</span>` +
            (settings.speech ? `<button type="button" class="hear" aria-label="${t.hear}" title="${t.hear}">▶</button>` : '') +
            (order >= 0 ? `<em>${order + 1}</em>` : '') +
            `</div>`
          );
        })
        .join('');

    const row = (label: string, control: string, cls = ''): string =>
      `<div class="row${cls}"><span>${label}</span>${control}</div>`;

    settingsDialog.innerHTML =
      `<form method="dialog"><h2>${t.setTitle}</h2>` +
      // Two columns where there is room: the game and the opponents, then the table and the aids.
      `<div class="cols"><div class="col">` +
      `<fieldset class="group"><legend>${t.secGame}</legend>` +
      row(t.setGame, seg('transfer', [['0', t.simple], ['1', t.transfer]], settings.transfer ? '1' : '0')) +
      row(t.setNextLead, seg('nextLead', [['winner', t.leadWinner], ['fool', t.leadFool]], settings.nextLead)) +
      row(t.setThink, seg('thinkMs', [['600', t.fast], ['1500', t.normal], ['4000', t.deep]], String(settings.thinkMs))) +
      check('firstBoutFive', t.setFive, settings.firstBoutFive) +
      `</fieldset>` +
      `<fieldset class="group"><legend>${t.setOpponents}</legend>` +
      seg('shown', [['real', t.realistic], ['cartoon', t.cartoon], ['fable', t.fable]], shown) +
      `<div class="roster"></div><p class="fine">${t.pickHint}</p>` +
      `</fieldset>` +
      `</div><div class="col">` +
      `<fieldset class="group"><legend>${t.secTable}</legend>` +
      check('portraits', t.setPortraits, settings.portraits) +
      row(t.portraitKind, seg('avatars', [['static', t.avStatic], ['context', t.avContext]], settings.avatars), ' sub') +
      check('phrases', t.setPhrases, settings.phrases) +
      check('speech', t.setSpeech, settings.speech) +
      check('autoDiscard', t.setAutoDiscard, settings.autoDiscard) +
      check('showArrow', t.setArrow, settings.showArrow) +
      check('trumpCount', t.setTrumpCount, settings.trumpCount) +
      check('stats', t.setStats, settings.stats) +
      `</fieldset>` +
      // The aids for learning the game, apart from the rest.
      `<fieldset class="group training"${settings.training ? '' : ' disabled'}>` +
      `<legend title="${t.aidNote}"><label><input type="checkbox" name="training"${settings.training ? ' checked' : ''}>` +
      `<span>${t.training}</span></label></legend>` +
      `<p class="fine">${t.aidNote}</p>` +
      check('showKnown', t.setKnown, settings.showKnown) +
      check('showPlayable', t.setPlayable, settings.showPlayable) +
      check('showTrumps', t.setTrumps, settings.showTrumps) +
      check('hints', t.setHints, settings.hints) +
      check('chance', t.setChance, settings.chance) +
      check('undo', t.setUndo, settings.undo) +
      check('gameLog', t.setLog, settings.gameLog) +
      check('openCards', t.setOpen, settings.openCards) +
      `</fieldset>` +
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
      save('durak.scores', tallies, session);
      render();
    });
    // These only change what is shown or heard, so they take effect at once, mid-game included.
    const apply = (change: Partial<Settings>): void => {
      settings = { ...settings, ...change };
      if (!aid('hints')) showHint = false;
      // What the advice knows, or whether it is wanted, may have changed with this.
      if ('openCards' in change || 'training' in change) dropAdvice();
      if (awaitingHuman && aid('chance')) void analyse();
      if (change.gameLog) logShown = 0;
      // Voice clips are fetched only while speech is on.
      if ('speech' in change) {
        if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
        else releaseVoices();
      }
      save('durak.settings', settings);
      render();
    };
    const boxes = [
      'portraits', 'phrases', 'speech', 'showKnown', 'autoDiscard', 'hints', 'showPlayable',
      'showTrumps', 'showArrow', 'trumpCount', 'stats', 'chance', 'undo', 'gameLog', 'openCards',
      'training',
    ] as const;
    // The kind of portrait is a choice only while there are portraits.
    const kinds = form.querySelector<HTMLElement>('.row.sub')!;
    const showKinds = (): void => {
      kinds.classList.toggle('off', !settings.portraits);
      for (const radio of kinds.querySelectorAll('input')) radio.disabled = !settings.portraits;
    };
    showKinds();
    for (const name of boxes) {
      const box = form.querySelector<HTMLInputElement>(`[name=${name}]`)!;
      box.addEventListener('change', () => {
        apply({ [name]: box.checked });
        if (name === 'speech') rosterEl.innerHTML = roster(); // the "hear" buttons come and go
        if (name === 'training') form.querySelector('.training')!.toggleAttribute('disabled', !box.checked);
        if (name === 'portraits') {
          showKinds();
          rosterEl.innerHTML = roster();
        }
      });
    }
    for (const radio of form.querySelectorAll<HTMLInputElement>('[name=avatars]')) {
      radio.addEventListener('change', () => {
        apply({ avatars: radio.value as AvatarMode });
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
  $('btn-about').addEventListener('click', () => aboutDialog.showModal());
  // Closing the log switches it off; it is switched on again in Settings.
  $('log-close').addEventListener('click', () => {
    settings = { ...settings, gameLog: false };
    save('durak.settings', settings);
    render();
  });
  $('langs').addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('a[data-lang]');
    if (!link) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // a new tab or window: follow the link
    e.preventDefault();
    settings = { ...settings, lang: link.dataset.lang as Lang };
    t = STRINGS[settings.lang];
    save('durak.settings', settings);
    // Keep the address in step with the language without reloading and losing the game.
    try {
      history.replaceState(null, '', `${PART_ROOT}${settings.lang}/`);
    } catch {
      // Not every place a page can be opened from allows this; the switch still works.
    }
    if (settings.speech) prepareVoices(settings.opponents.map(characterById), settings.lang);
    render();
  });
  $('discard-label').addEventListener('click', (e) => {
    e.stopPropagation();
    if (aid('showKnown')) openDiscard();
  });
  // The fortune-teller smiles and says one of her lines while the pointer is on her.
  const callerFace = tellerLink.querySelector('img')!;
  const callerTip = tellerLink.querySelector<HTMLElement>('.tip')!;
  const calm = tellerPicture(caller, 'neutral');
  const glad = tellerPicture(caller, 'pleased');
  let lastCall = -1;
  callerFace.src = calm;
  new Image().src = glad; // so that her smile does not wait for the network
  const beckon = (): void => {
    const calls = t.fortuneCalls;
    let i = (Math.random() * calls.length) | 0;
    if (i === lastCall) i = (i + 1) % calls.length;
    lastCall = i;
    callerTip.textContent = calls[i];
    callerFace.src = glad;
  };
  const rest = (): void => {
    callerFace.src = calm;
  };
  tellerLink.addEventListener('pointerenter', beckon);
  tellerLink.addEventListener('focus', beckon);
  tellerLink.addEventListener('pointerleave', rest);
  tellerLink.addEventListener('blur', rest);
  // The page's keys play the game; on her, Enter follows the link instead.
  tellerLink.addEventListener('keydown', (e) => e.stopPropagation());
  tellerLink.addEventListener('click', (e) => e.stopPropagation());
  stage.addEventListener('click', cancelSelection);
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return; // a dialog handles its own keys
    if (e.key === 'Escape') {
      cancelSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      undo();
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

  const firstVisit = load<Partial<Settings>>('durak.settings', {}).opponents === undefined;
  deal();
  if (firstVisit) openSettings();
}
