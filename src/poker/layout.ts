import { PCard } from './cards';
import { HandState } from './engine';

export interface Place {
  x: number;
  y: number;
  rot: number;
  scale: number;
  z: number;
  up: boolean;
  where: 'deck' | 'hole' | 'board';
}

export interface Spot {
  x: number;
  y: number;
}

export interface PokerGeometry {
  cw: number;
  ch: number;
  seats: Spot[]; // name plates: centred on x, top at y (the player's own: left edge, middle)
  avatars: ({ x: number; y: number; size: number } | null)[];
  bets: Spot[]; // where each seat's chips in front of them are labelled
  dealer: Spot[]; // where the dealer button sits for each seat
  pot: Spot;
  deck: Spot;
  actionY: number;
}

export interface LayoutOptions {
  human: number;
  reveal: boolean[]; // whose cards lie face up
  portraits: 'off' | 'normal' | 'large';
  highlight: PCard[]; // the winning five, lifted a little
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Where everything goes at an oval table. The player sits at the bottom; the others round the
 * top, clockwise from the player's left. The board lies in the middle with the pot above it.
 */
export function computeLayout(s: HandState, W: number, H: number, opt: LayoutOptions): { places: Map<PCard, Place>; geo: PokerGeometry } {
  const n = s.stacks.length;
  const others = n - 1;
  const cw = clamp(Math.min(W / 11.5, H / 7.4), 36, 96);
  const ch = cw * 1.5;
  const narrow = W < 760;
  const places = new Map<PCard, Place>();

  const portrait =
    opt.portraits === 'off'
      ? 0
      : opt.portraits === 'large'
        ? clamp(Math.min(W * 0.12, H * 0.17), 56, 150)
        : clamp(Math.min(W * 0.09, H * 0.13), 40, 100);
  const small = 0.62;
  const sw = cw * small;

  // The player's own two cards are drawn larger where the table makes every card small.
  const mine = narrow ? 1.7 : 1;
  const handY = H - (ch * mine) / 2 - 14;
  // On a narrow screen the betting controls wrap onto three rows, so they stand higher.
  const actionY = H - ch * mine - 14 - ch * 0.12 - (narrow ? 120 : 30);
  const top = 26 + Math.max(portrait, sw * 1.5) / 2;
  const centre = { x: W / 2, y: (top + actionY) / 2 - 6 };
  const rx = W / 2 - Math.max(portrait, sw * 2) / 2 - 24;
  const ry = Math.max(40, centre.y - top);

  const seats: Spot[] = [];
  const avatars: PokerGeometry['avatars'] = [];
  const bets: Spot[] = [];
  const dealer: Spot[] = [];
  for (let p = 0; p < n; p++) {
    if (p === opt.human) {
      const hand = s.folded[p] ? [] : s.holes[p];
      hand.forEach((c, i) => {
        places.set(c, {
          x: W / 2 + (i - (hand.length - 1) / 2) * cw * 0.72 * mine,
          y: handY - (opt.highlight.includes(c) ? ch * 0.1 : 0),
          rot: (i - 0.5) * 5,
          scale: mine,
          z: 300 + i,
          up: true,
          where: 'hole',
        });
      });
      const right = W / 2 + cw * 1.15 + 14;
      seats.push(right + 200 < W ? { x: right, y: handY - ch * 0.2 } : { x: 12, y: actionY - 92 });
      avatars.push(null);
      bets.push(narrow ? { x: W / 2, y: handY - (ch * mine) / 2 - 16 } : { x: W / 2, y: actionY - 36 });
      dealer.push({ x: W / 2 - cw * 1.25, y: handY - ch * 0.35 });
      continue;
    }
    const slot = (p - opt.human + n) % n; // 1..others, clockwise from the left
    const angle = ((160 + (slot * 220) / (others + 1)) * Math.PI) / 180;
    const x = centre.x + rx * Math.cos(angle);
    const y = centre.y + ry * Math.sin(angle);
    avatars.push(portrait ? { x, y, size: portrait } : null);
    seats.push({ x, y: y + (portrait ? portrait / 2 - 24 : 14) });
    // The cards beside the portrait, on the side towards the middle of the table.
    const side = x < centre.x - 4 ? 1 : x > centre.x + 4 ? -1 : 1;
    const cx = x + side * (portrait / 2 + sw * 0.9);
    // Folded cards go to the pile in the middle.
    const hand = s.folded[p] ? [] : s.holes[p];
    const up = opt.reveal[p];
    hand.forEach((c, i) => {
      places.set(c, {
        x: cx + (i - 0.5) * sw * (up ? 0.75 : 0.45),
        y: y - (opt.highlight.includes(c) ? 8 : 0),
        rot: (i - 0.5) * 6,
        scale: up ? small * 1.15 : small,
        z: 200 + p * 2 + i,
        up,
        where: 'hole',
      });
    });
    const toward = (k: number): Spot => ({ x: x + (centre.x - x) * k, y: y + (centre.y - y) * k });
    bets.push(toward(0.42));
    dealer.push({ x: cx + side * sw * 0.2, y: y + sw * 0.95 });
  }

  // The board, five cards in a row.
  const gap = cw * 1.08;
  s.board.forEach((c, i) => {
    places.set(c, {
      x: centre.x + (i - 2) * gap,
      y: centre.y - (opt.highlight.includes(c) ? ch * 0.08 : 0),
      rot: 0,
      scale: 1,
      z: 100 + i,
      up: true,
      where: 'board',
    });
  });
  // Every other card (the deck, the burnt and the folded ones) lies in one pile in the middle,
  // face down, under the board.
  const deck = { x: centre.x, y: centre.y };
  let k = 0;
  for (let c = 0; c < 52; c++) {
    if (places.has(c)) continue;
    places.set(c, { x: deck.x - k * 0.08, y: deck.y - k * 0.12, rot: 0, scale: 0.8, z: 1 + k, up: false, where: 'deck' });
    k++;
  }

  return {
    places,
    geo: { cw, ch, seats, avatars, bets, dealer, pot: { x: centre.x, y: centre.y - ch / 2 - 22 }, deck, actionY },
  };
}

