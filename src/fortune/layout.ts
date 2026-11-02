import { DECK_SIZE } from '../engine/cards';
import { Spread } from './spreads';

// Where everything goes on the cloth: the reader at the top, as if across the table, and below
// her the deck, the fan of cards to pick from, and the places of the spread.

export interface Point {
  x: number;
  y: number;
}

export interface Frame {
  cw: number; // the width of a card in the spread; other cards are drawn at a scale of it
  ch: number;
  portrait: Point & { size: number }; // top left corner and side
  area: { top: number; bottom: number }; // the cloth below the reader, above the buttons
  deck: Point & { scale: number };
  fan: (Point & { rot: number })[]; // the 36 places of the fan, left to right
  fanScale: number;
  slots: Point[]; // the centres of the spread's places
  placeLabels: Point[]; // under each card: top centre
  rowLabels: Point[]; // beside each row: right edge, middle
  colLabels: Point[]; // above each column: bottom centre
}

const RATIO = 1.5; // card height to width
const GAP_X = 0.22; // between cards in a spread, in card widths
const GAP_Y = 0.14; // in card heights
const LABEL_H = 20;

/**
 * Lays out a stage of the given size. While cards are being picked the spread's places share
 * the cloth with the fan; otherwise they have all of it.
 */
export function frame(width: number, height: number, spread: Spread | null, picking: boolean): Frame {
  const size = Math.round(Math.max(64, Math.min(210, width * 0.26, height * 0.24)));
  const portrait = { x: Math.round((width - size) / 2), y: 10, size };
  const top = portrait.y + size + 14;
  const bottom = height - 58;
  const areaH = Math.max(80, bottom - top);

  // The fan: one arc of all 36 cards, or two or three on a narrow screen, so that each card
  // shows enough of itself to be touched.
  const rowCount = width < 420 ? 3 : width < 640 ? 2 : 1;
  const fanH = picking ? areaH * [0.4, 0.5, 0.56][rowCount - 1] : 0;
  const slotTop = top;
  const slotH = areaH - fanH;

  // The spread's places: a grid of cells, with room for the words that go with them.
  const slots = spread?.slots ?? [{ x: 0, y: 0 }];
  const xs = slots.map((s) => s.x);
  const ys = slots.map((s) => s.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const cols = Math.max(...xs) - minX + 1;
  const rows = Math.max(...ys) - minY + 1;
  const labelH = spread?.places ? LABEL_H : 0;
  const rowLabelW = spread?.rows ? Math.min(120, width * 0.22) : 0;
  const colLabelH = spread?.cols ? LABEL_H + 4 : 0;
  const byWidth = (width - rowLabelW - 24) / (cols * (1 + GAP_X));
  const byHeight = (slotH - colLabelH - rows * labelH - 8) / (rows * RATIO * (1 + GAP_Y));
  const cw = Math.round(Math.max(28, Math.min(150, byWidth, byHeight)));
  const ch = cw * RATIO;
  const cellW = cw * (1 + GAP_X);
  const cellH = ch * (1 + GAP_Y) + labelH;
  const gridW = cols * cellW;
  const gridH = colLabelH + rows * cellH;
  // A lone row label column pushes the grid right; the grid and its labels are centred together.
  const x0 = (width - gridW - rowLabelW) / 2 + rowLabelW;
  const y0 = slotTop + Math.max(0, (slotH - gridH) / 2) + colLabelH;
  const centre = (s: Point): Point => ({
    x: x0 + (s.x - minX + 0.5) * cellW,
    y: y0 + (s.y - minY) * cellH + (ch * (1 + GAP_Y)) / 2,
  });
  const placed = slots.map(centre);
  const placeLabels = placed.map((p) => ({ x: p.x, y: p.y + ch / 2 + 3 }));
  const rowLabels = Array.from({ length: rows }, (_, r) => ({
    x: x0 - 14,
    y: y0 + r * cellH + (ch * (1 + GAP_Y)) / 2,
  }));
  const colLabels = Array.from({ length: cols }, (_, c) => ({ x: x0 + (c + 0.5) * cellW, y: y0 - 4 }));

  const perRow = DECK_SIZE / rowCount;
  const ROW_STEP = RATIO * 0.92; // rows overlap a little, in card widths
  const DIP = 0.16; // how far the ends of an arc sink, in card widths
  const fanUnits = (rowCount - 1) * ROW_STEP + RATIO + DIP;
  let fw = Math.min(104, fanH / fanUnits);
  const room = width - 28;
  let step = (room - fw) / (perRow - 1);
  if (step > fw * 0.5) step = fw * 0.5; // no wider than it needs to be
  if (step < 9) {
    step = 9;
    fw = Math.min(fw, room - step * (perRow - 1));
  }
  const fanTop = bottom - fanH + (fanH - fw * fanUnits) / 2;
  const fan = Array.from({ length: DECK_SIZE }, (_, i) => {
    const r = Math.floor(i / perRow);
    const k = i % perRow;
    const t = (k - (perRow - 1) / 2) / ((perRow - 1) / 2);
    return {
      x: width / 2 + (k - (perRow - 1) / 2) * step,
      y: fanTop + fw * (RATIO / 2 + r * ROW_STEP + t * t * DIP),
      rot: t * 9,
    };
  });

  const deckW = Math.min(110, areaH / RATIO / 2.2, width * 0.24);
  return {
    cw,
    ch,
    portrait,
    area: { top, bottom },
    deck: { x: width / 2, y: top + areaH / 2, scale: deckW / cw },
    fan,
    fanScale: fw / cw,
    slots: placed,
    placeLabels,
    rowLabels,
    colLabels,
  };
}
