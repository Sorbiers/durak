import { Card, RANKS, SUITS, rankOf, suitOf } from '../engine/cards';
import { GameState } from '../engine/game';

export interface Place {
  x: number; // centre of the card in stage pixels
  y: number;
  rot: number; // degrees
  scale: number;
  z: number;
  up: boolean; // face up
  where: 'deck' | 'hand' | 'table' | 'discard';
  seat: number; // owner when in a hand, otherwise -1
}

export interface Geometry {
  cw: number;
  ch: number;
  seats: { x: number; y: number }[]; // where each seat's name plate goes
  avatars: ({ x: number; y: number; size: number } | null)[]; // portrait centre, per seat
  // Where "leads" / "defends" goes. Beside a portrait it starts at x; without one it is
  // centred on x, above the cards.
  roles: ({ x: number; y: number; beside: boolean } | null)[];
  resign: { x: number; y: number }; // bottom right corner of the Resign button
  aims: { x: number; y: number }[]; // where the table meets each seat: ends of the attack arrow
  centre: { x: number; y: number }; // middle of the table
  deck: { x: number; y: number };
  discard: { x: number; y: number }; // where the discard's label goes: centred on x, at y
  actionY: number;
}

export interface LayoutOptions {
  human: number;
  selected: Card[];
  revealAll: boolean; // game over: turn every hand face up
  showKnown: boolean; // memory aid: show the cards that were once face up, in hands and in the discard
  avatars: 'off' | 'normal' | 'large'; // room for a portrait beside each opponent's cards
}

const SMALL = 0.6; // opponents' cards are drawn smaller
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Stable pseudo-random number in [-0.5, 0.5) per card, so thrown cards lie a little askew. */
function jitter(c: Card, salt: number): number {
  const h = Math.imul(c * 31 + salt * 17 + 7, 2654435761) >>> 0;
  return h / 4294967296 - 0.5;
}

/** Order of the human hand: plain suits together, trumps on the right, low to high. */
export function sortHand(hand: Card[], trump: number): Card[] {
  const key = (c: Card) => (suitOf(c) === trump ? 100 : suitOf(c) * 10) + rankOf(c);
  return hand.slice().sort((a, b) => key(a) - key(b));
}

export function computeLayout(
  s: GameState,
  W: number,
  H: number,
  opt: LayoutOptions,
): { places: Map<Card, Place>; geo: Geometry } {
  const n = s.hands.length;
  const cw = clamp(Math.min(W / 7.2, H / 5.8), 44, 108);
  const ch = cw * 1.5; // two by three, the shape of the pictures in public/durak/cards
  const places = new Map<Card, Place>();

  // Opponents share the top edge. With portraits on, each gets one beside their cards.
  const slotW = W / Math.max(1, n - 1);
  const large = opt.avatars === 'large';
  const portrait =
    opt.avatars === 'off'
      ? 0
      : large
        ? clamp(Math.min(slotW * 0.45, ch * 1.35), 56, 240)
        : clamp(Math.min(slotW * 0.3, ch * 0.9), 40, 150);
  const topH = Math.max(portrait, ch * SMALL);
  // What each opponent is doing is written above their cards. Where the cards would reach
  // the top edge, everything moves down to leave that line free.
  const ROLE_ROOM = 26;
  const top = 12 + Math.max(0, ROLE_ROOM - (topH - ch * SMALL) / 2);
  // A chosen card rises by this much, and the prompt sits clear of it.
  const lift = ch * 0.14;
  // On a narrow screen the prompt and the buttons stack, with the player's plate above them.
  const narrow = W < 760;
  // A large portrait carries its name plate on its lower edge, which gives the height of
  // the plate back to the table. On a narrow screen portraits are too small for that.
  const overlay = large && !narrow;
  const plateY = overlay ? top + topH - 28 : top + topH + 8;
  const tableTop = overlay ? top + topH + 16 : plateY + 44;
  const handY = H - ch / 2 - 16;
  const actionY = H - ch - 16 - lift - (narrow ? 62 : 36);
  const tableBottom = actionY - (narrow ? 84 : 34);
  const tableY = (tableTop + tableBottom) / 2;

  // Deck on the left with the trump card lying crosswise beneath it.
  const deck = { x: 16 + cw * 0.5, y: tableY };
  s.deck.forEach((c, i) => {
    if (i === 0) {
      places.set(c, { x: deck.x + cw * 0.52, y: deck.y, rot: 90, scale: 1, z: 1, up: true, where: 'deck', seat: -1 });
    } else {
      places.set(c, { x: deck.x - i * 0.25, y: deck.y - i * 0.4, rot: 0, scale: 1, z: 1 + i, up: false, where: 'deck', seat: -1 });
    }
  });

  // The discard, on the right. Normally a heap, face down. As a memory aid it is laid out to
  // be read: a column for each suit, low to high, each card showing its rank above the next.
  // The cards are small for that, so the columns need room: on a screen where they would be
  // too small to read, the open discard stays a heap and is read through its label instead.
  const roomH = tableBottom - tableTop;
  const STRIP = 0.2; // how much of a card shows above the one lying on it, of its height
  const columns = SUITS; // one column per suit
  const mostInColumn = RANKS;
  const tall = 1 + (mostInColumn - 1) * STRIP; // height of a full column, in cards
  const small = Math.min(0.58, (roomH * 0.96) / (ch * tall), (W * 0.27) / (cw * columns + 18));
  const laidOut = opt.showKnown && small * cw >= 36;
  const gap = 6;
  const pileW = laidOut ? columns * cw * small + (columns - 1) * gap : cw * 1.5;
  const pileLeft = laidOut ? W - 12 - pileW : W - 16 - cw * 0.8 - cw * 0.7;
  const pileTop = laidOut ? tableY - (ch * small * tall) / 2 : tableY - ch / 2;
  const heap = { x: W - 16 - cw * 0.8, y: tableY };
  const discard = { x: laidOut ? pileLeft + pileW / 2 : heap.x, y: pileTop - 30 };
  if (laidOut) {
    for (let suit = 0; suit < columns; suit++) {
      const column = s.discard.filter((c) => suitOf(c) === suit).sort((a, b) => a - b);
      column.forEach((c, i) => {
        places.set(c, {
          x: pileLeft + suit * (cw * small + gap) + (cw * small) / 2,
          y: pileTop + (ch * small) / 2 + i * ch * small * STRIP,
          rot: 0,
          scale: small,
          z: 1 + i,
          up: true,
          where: 'discard',
          seat: -1,
        });
      });
    }
  } else {
    s.discard.forEach((c, i) => {
      places.set(c, {
        x: heap.x + jitter(c, 1) * cw * 0.2,
        y: heap.y + jitter(c, 2) * cw * 0.2,
        rot: jitter(c, 3) * 70,
        scale: 0.92,
        z: 1 + i,
        up: opt.showKnown,
        where: 'discard',
        seat: -1,
      });
    });
  }

  // The bout in the middle: each attack card with its answer overlapping it.
  const m = s.attacks.length;
  if (m > 0) {
    const left = deck.x + cw * 1.22 + 14;
    const right = pileLeft - 10;
    // Shrink the bout just enough for all its rows to fit between the hands.
    let scale = 1;
    let perRow = m;
    let rows = 1;
    for (; scale > 0.5; scale -= 0.05) {
      perRow = clamp(Math.floor((right - left) / (cw * 1.45 * scale)), 1, m);
      rows = Math.ceil(m / perRow);
      if (rows * ch * 1.2 * scale <= roomH) break;
    }
    const pairW = cw * 1.45 * scale;
    const rowH = ch * 1.2 * scale;
    const cx = (left + right) / 2;
    for (let i = 0; i < m; i++) {
      const row = Math.floor(i / perRow);
      const inRow = row === rows - 1 ? m - row * perRow : perRow;
      const col = i - row * perRow;
      const x = cx + (col - (inRow - 1) / 2) * pairW - cw * 0.18 * scale;
      const y = tableY + (row - (rows - 1) / 2) * rowH - ch * 0.06 * scale;
      const a = s.attacks[i];
      places.set(a, { x, y, rot: jitter(a, 4) * 8, scale, z: 100 + i * 2, up: true, where: 'table', seat: -1 });
      const d = s.defenses[i];
      if (d >= 0) {
        places.set(d, {
          // Far enough aside that the rank and suit of the beaten card stay readable.
          x: x + cw * 0.36 * scale,
          y: y + ch * 0.16 * scale,
          rot: 7 + jitter(d, 5) * 8,
          scale,
          z: 101 + i * 2,
          up: true,
          where: 'table',
          seat: -1,
        });
      }
    }
  }

  // Hands. The human sits at the bottom; the others along the top, clockwise from the left.
  const seats: { x: number; y: number }[] = [];
  const avatars: Geometry['avatars'] = [];
  const roles: Geometry['roles'] = [];
  const aims: Geometry['aims'] = [];
  const others = n - 1;
  for (let p = 0; p < n; p++) {
    const hand = s.hands[p];
    if (p === opt.human) {
      const cards = sortHand(hand, s.trump);
      const k = cards.length;
      const step = k > 1 ? Math.min(cw * 0.66, (W - 32 - cw) / (k - 1)) : 0;
      // A gentle fan whose ends dip by the same small amount however many cards are held.
      const half = Math.max(1, (k - 1) / 2);
      cards.forEach((c, i) => {
        const off = i - (k - 1) / 2;
        const bend = off / half; // -1 at the left end, 1 at the right
        const lifted = opt.selected.includes(c);
        places.set(c, {
          x: W / 2 + off * step,
          y: handY + bend * bend * Math.min(12, k * 2) - (lifted ? lift : 0),
          rot: bend * Math.min(5, k),
          scale: 1,
          z: 300 + i,
          up: true,
          where: 'hand',
          seat: p,
        });
      });
      seats.push({ x: 16, y: narrow ? actionY - 66 : actionY });
      avatars.push(null);
      roles.push(null);
      aims.push({ x: W / 2, y: tableBottom });
      continue;
    }
    const slot = (p - opt.human + n) % n; // 1..n-1, clockwise
    const x = W * (others === 1 ? 0.5 : others === 2 ? [0.27, 0.73][slot - 1] : [0.17, 0.5, 0.83][slot - 1]);
    const k = hand.length;
    const cardW = cw * SMALL;
    const easyStep = cardW * 0.42;
    let step: number;
    let first: number; // centre of the first card
    if (portrait > 0) {
      // Portrait on the left, cards fanning out to its right. The pair is centred on the
      // seat for a hand of six and the portrait stays put as the hand grows or shrinks.
      const group = Math.min(portrait + 10 + 5 * easyStep + cardW, slotW - 8);
      const left = x - group / 2;
      const fanLeft = left + portrait + 10;
      const fanRoom = x + slotW / 2 - 8 - fanLeft;
      step = k > 1 ? Math.min(easyStep, (fanRoom - cardW) / (k - 1)) : 0;
      first = fanLeft + cardW / 2;
      avatars.push({ x: left + portrait / 2, y: top + topH / 2, size: portrait });
      // Next to the picture, a little below its top edge, and never down on the cards.
      roles.push({ x: fanLeft, y: Math.min(top + 20, top + (topH - cardW * 1.5) / 2 - 13), beside: true });
    } else {
      step = k > 1 ? Math.min(easyStep, (slotW * 0.55) / (k - 1)) : 0;
      first = x - ((k - 1) / 2) * step;
      avatars.push(null);
      roles.push({ x, y: top + (topH - cardW * 1.5) / 2 - 14, beside: false });
    }
    hand.forEach((c, i) => {
      const off = i - (k - 1) / 2;
      places.set(c, {
        x: first + i * step,
        y: top + topH / 2,
        rot: off * 1.2,
        scale: SMALL,
        z: 200 + i,
        up: opt.revealAll || (opt.showKnown && s.seen[c] === 1),
        where: 'hand',
        seat: p,
      });
    });
    const spot = avatars[avatars.length - 1];
    seats.push({ x: overlay && spot ? spot.x : x, y: plateY });
    aims.push({ x, y: tableTop - 4 });
  }

  const resign = { x: W - 12, y: H - 12 }; // the bottom right corner
  return {
    places,
    geo: { cw, ch, seats, avatars, roles, resign, aims, centre: { x: W / 2, y: tableY }, deck, discard, actionY },
  };
}
