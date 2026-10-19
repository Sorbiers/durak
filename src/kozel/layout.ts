import { Card, rankOf, suitOf } from '../engine/cards';
import { KozelState, STRENGTH, teamOf } from './engine';

export interface Place {
  x: number;
  y: number;
  rot: number;
  scale: number;
  z: number;
  up: boolean;
  where: 'deck' | 'hand' | 'table' | 'taken';
}

export interface Spot {
  x: number;
  y: number;
}

export interface KozelGeometry {
  cw: number;
  ch: number;
  seats: Spot[]; // name plates: centred on x, top at y (the player's own: left edge, middle)
  avatars: ({ x: number; y: number; size: number } | null)[];
  roles: (Spot | null)[]; // "leads" / "takes" chips above each opponent's cards
  deck: Spot;
  piles: Spot[]; // the cards each pair has taken
  actionY: number;
  centre: Spot;
}

export interface LayoutOptions {
  human: number;
  selected: Card[];
  revealAll: boolean; // the opponents' and partner's hands face up
  portraits: 'off' | 'normal' | 'large';
}

const SMALL = 0.6; // others' cards are drawn smaller
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The player's hand in playing order: trumps to the right, each suit low to high. */
export function sortHand(hand: Card[], trump: number): Card[] {
  const key = (c: Card): number => (suitOf(c) === trump ? 4 : suitOf(c)) * 10 + STRENGTH[rankOf(c)];
  return hand.slice().sort((a, b) => key(a) - key(b));
}

/**
 * Where everything goes. The player sits at the bottom, the partner across the table at the
 * top, the opponents at the left and right. Each play of the trick lies in front of whoever
 * made it; the deck is in the bottom left corner, the pairs' tricks in the right-hand corners.
 */
export function computeLayout(
  s: KozelState,
  W: number,
  H: number,
  opt: LayoutOptions,
): { places: Map<Card, Place>; geo: KozelGeometry } {
  const cw = clamp(Math.min(W / 8.5, H / 6.6), 40, 104);
  const ch = cw * 1.5;
  const sw = cw * SMALL;
  const sh = ch * SMALL;
  const places = new Map<Card, Place>();
  const narrow = W < 760;

  const large = opt.portraits === 'large';
  const portrait =
    opt.portraits === 'off'
      ? 0
      : large
        ? clamp(Math.min(W * 0.17, H * 0.2), 56, 190)
        : clamp(Math.min(W * 0.13, H * 0.17), 44, 130);
  const lift = ch * 0.14;
  const handY = H - ch / 2 - 14;
  const actionY = H - ch - 14 - lift - (narrow ? 58 : 32);

  // The partner, across the table.
  const top = 34;
  const topH = Math.max(portrait, sh);
  const seats: Spot[] = [];
  const avatars: KozelGeometry['avatars'] = [];
  const roles: KozelGeometry['roles'] = [];
  const overlay = large && !narrow; // a large portrait carries its name on its lower edge

  // The opponents, at the sides, below the partner's row.
  const sideTop = top + topH + (overlay ? 14 : 40);
  const sideW = Math.max(portrait, sw + 3 * sw * 0.42);
  const tableTop = sideTop;
  const tableBottom = actionY - (narrow ? 70 : 30);
  const centre = { x: W / 2, y: (top + topH + 10 + tableBottom) / 2 + 8 };

  const handOf = (p: number): Card[] => s.hands[p];
  for (let p = 0; p < 4; p++) {
    const hand = handOf(p);
    if (p === opt.human) {
      const cards = sortHand(hand, s.trump);
      const k = cards.length;
      const step = Math.min(cw * 0.72, k > 1 ? (W - 32 - cw) / (k - 1) : 0);
      cards.forEach((c, i) => {
        const off = i - (k - 1) / 2;
        places.set(c, {
          x: W / 2 + off * step,
          y: handY + Math.abs(off) * 4 - (opt.selected.includes(c) ? lift : 0),
          rot: off * 3,
          scale: 1,
          z: 300 + i,
          up: true,
          where: 'hand',
        });
      });
      // The plate sits just right of the hand, clear of the opponent on the left; where the hand
      // fills the width, above it on the left.
      const right = W / 2 + ((Math.max(k, 1) - 1) * step + cw) / 2 + 18;
      seats.push(right + 190 < W - 16 - sh - 10 ? { x: right, y: handY - ch * 0.2 } : { x: 16, y: actionY - 40 });
      avatars.push(null);
      roles.push(null);
      continue;
    }
    const seat = (p - opt.human + 4) % 4; // 1 left, 2 across, 3 right
    const k = hand.length;
    const step = sw * 0.42;
    const up = opt.revealAll;
    if (seat === 2) {
      // Portrait, then the cards fanning to its right; the pair centred on the table.
      const group = portrait + (portrait ? 10 : 0) + 3 * step + sw;
      const left = W / 2 - group / 2;
      const fanLeft = left + portrait + (portrait ? 10 : 0);
      hand.forEach((c, i) => {
        places.set(c, { x: fanLeft + sw / 2 + i * step, y: top + topH / 2, rot: 0, scale: SMALL, z: 200 + i, up, where: 'hand' });
      });
      avatars.push(portrait ? { x: left + portrait / 2, y: top + topH / 2, size: portrait } : null);
      seats.push({ x: portrait ? left + portrait / 2 : W / 2, y: overlay ? top + topH - 28 : top + topH + 8 });
      roles.push({ x: fanLeft + (3 * step + sw) / 2, y: top - 14 });
    } else {
      // A column at the side: portrait, cards under it, the name under them.
      const x = seat === 1 ? 12 + sideW / 2 : W - 12 - sideW / 2;
      let y = sideTop;
      if (portrait) {
        avatars.push({ x, y: y + portrait / 2, size: portrait });
        y += portrait + 8;
      } else avatars.push(null);
      const first = x - ((Math.max(k, 1) - 1) * step) / 2;
      hand.forEach((c, i) => {
        places.set(c, { x: first + i * step, y: y + sh / 2, rot: 0, scale: SMALL, z: 200 + i, up, where: 'hand' });
      });
      roles.push({ x, y: sideTop - 14 });
      seats.push({ x, y: y + sh + 6 });
    }
  }

  // The trick: each play in front of whoever made it.
  const sideRight = 12 + sideW;
  const reach = Math.max(cw * 1.2, Math.min(cw * 2.3, W / 2 - sideRight - cw * 1.1));
  const rise = Math.min(ch * 0.62, (tableBottom - tableTop) / 2 - ch * 0.3);
  const fronts: Spot[] = [
    { x: centre.x, y: centre.y + rise },
    { x: centre.x - reach, y: centre.y },
    { x: centre.x, y: centre.y - rise },
    { x: centre.x + reach, y: centre.y },
  ];
  s.table.forEach((play, order) => {
    const seat = (play.seat - opt.human + 4) % 4;
    const at = fronts[seat];
    const k = play.cards.length;
    const step = cw * 0.34;
    play.cards.forEach((c, i) => {
      const off = i - (k - 1) / 2;
      places.set(c, {
        x: at.x + off * step,
        y: at.y + (order === s.best ? 0 : 4),
        rot: off * 4 + (seat === 1 ? -6 : seat === 3 ? 6 : 0),
        scale: 1,
        z: 100 + order * 5 + i,
        up: play.open,
        where: 'table',
      });
    });
  });

  // The deck in the bottom left corner, the trump card crosswise under it.
  const deck = { x: 16 + cw * 0.55, y: handY - ch * 0.05 };
  s.stock.forEach((c, i) => {
    const bottom = i === 0;
    places.set(c, {
      x: bottom ? deck.x + cw * 0.5 : deck.x - i * 0.25,
      y: bottom ? deck.y : deck.y - i * 0.4,
      rot: bottom ? 90 : 0,
      scale: 1,
      z: 1 + i,
      up: bottom && c === s.trumpCard,
      where: 'deck',
    });
  });

  // Tricks taken: ours in the bottom right corner, theirs in the top right.
  const piles: Spot[] = [
    { x: W - 16 - sh / 2, y: handY },
    { x: W - 16 - sh / 2, y: top + sw / 2 },
  ];
  const mine = teamOf(opt.human);
  for (let team = 0; team < 2; team++) {
    const at = team === mine ? piles[0] : piles[1];
    s.taken[team].forEach((c, i) => {
      places.set(c, { x: at.x - i * 0.15, y: at.y - i * 0.25, rot: 90, scale: SMALL, z: 1 + i, up: false, where: 'taken' });
    });
  }

  return {
    places,
    geo: {
      cw,
      ch,
      seats,
      avatars,
      roles,
      deck,
      piles: mine === 0 ? piles : [piles[1], piles[0]],
      actionY,
      centre,
    },
  };
}
