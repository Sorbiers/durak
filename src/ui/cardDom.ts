import { Card, rankOf, suitOf } from '../engine/cards';
import { ASSETS } from './root';

// How a card is drawn, shared by the games.

const COURT_LOW = 5; // jack
const COURT_HIGH = 7; // king
const PICTURE_NAMES = ['jack', 'queen', 'king', 'ace']; // ranks 5..8
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

const SUIT_SVG = [
  '<path d="M50 6C80 32 92 46 92 60c0 13-10 20-20 20-8 0-14-4-18-10 1 10 4 18 10 24H36c6-6 9-14 10-24-4 6-10 10-18 10C18 80 8 73 8 60 8 46 20 32 50 6Z"/>',
  '<path d="M50 88C20 62 8 46 8 30 8 16 19 8 30 8c9 0 16 5 20 13 4-8 11-13 20-13 11 0 22 8 22 22 0 16-12 32-42 58Z"/>',
  '<path d="M50 4c10 18 24 34 40 46-16 12-30 28-40 46C40 78 26 62 10 50 26 38 40 22 50 4Z"/>',
  '<circle cx="50" cy="27" r="20"/><circle cx="27" cy="58" r="20"/><circle cx="73" cy="58" r="20"/><path d="M44 44h12c0 26 3 40 9 50H35c6-10 9-24 9-50Z"/>',
];

export const suitSvg = (suit: number): string =>
  `<svg class="suit" viewBox="0 0 100 100" aria-hidden="true">${SUIT_SVG[suit]}</svg>`;
export const isRed = (suit: number): boolean => suit === 1 || suit === 2;

/**
 * A card with its face and its back. The rank letters are left empty, to be written in the
 * page's language (every element of class "rank").
 */
export function cardElement(c: Card): HTMLElement {
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
    const base = `${ASSETS}cards/${PICTURE_NAMES[rank - COURT_LOW]}_${SUIT_NAMES[suit]}`;
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
  return el;
}
