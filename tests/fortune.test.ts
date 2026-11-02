import { describe, expect, it } from 'vitest';
import { DECK_SIZE, makeCard } from '../src/engine/cards';
import { LINES, Line, OWN_LINES, TEXTS, lineFor } from '../src/fortune/i18n';
import { EMBLEMS, LENORMAND, RUSSIAN, SUIT_LEADS, WISH_ANSWERS } from '../src/fortune/meanings';
import { decodeReading, deckFor, encodeReading, lean, outcome } from '../src/fortune/reading';
import { SPREADS, spreadById } from '../src/fortune/spreads';
import { TELLERS, tellerById, tellerPicture } from '../src/fortune/tellers';
import { Lang } from '../src/ui/i18n';
import { portraitUrl } from '../src/ui/portraits';

const LANGS: Lang[] = ['ru', 'en', 'fr'];
const S = 0;
const H = 1;
const D = 2;
const C = 3;
const spread = (id: string) => spreadById(id)!;

describe('meanings', () => {
  it('gives every card a keyword and a sentence in every language, in both systems', () => {
    expect(RUSSIAN).toHaveLength(DECK_SIZE);
    expect(LENORMAND).toHaveLength(DECK_SIZE);
    for (let c = 0; c < DECK_SIZE; c++) {
      for (const m of [RUSSIAN[c], LENORMAND[c]]) {
        for (const lang of LANGS) {
          const [key, sentence] = m.text[lang];
          expect(key.length).toBeGreaterThan(1);
          expect(sentence.length).toBeGreaterThan(10);
        }
      }
      for (const lang of LANGS) expect(LENORMAND[c].name[lang].length).toBeGreaterThan(1);
    }
  });

  it('prints the 36 Lenormand cards in order on 36 different playing cards', () => {
    expect(EMBLEMS.map((e) => e.n)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    expect(new Set(EMBLEMS.map((e) => e.card)).size).toBe(DECK_SIZE);
  });

  it('puts the emblems on the usual insets', () => {
    expect(EMBLEMS[0].card).toBe(makeCard(H, 3)); // Rider, nine of hearts
    expect(EMBLEMS[27].card).toBe(makeCard(H, 8)); // Gentleman, ace of hearts
    expect(EMBLEMS[28].card).toBe(makeCard(S, 8)); // Lady, ace of spades
    expect(EMBLEMS[35].card).toBe(makeCard(C, 0)); // Cross, six of clubs
  });

  it('has a line for every suit and every moment, in every language', () => {
    for (const lang of LANGS) {
      expect(SUIT_LEADS[lang]).toHaveLength(4);
      expect(WISH_ANSWERS[lang]).toHaveLength(4);
      for (const lines of Object.values(LINES[lang])) expect(lines.length).toBeGreaterThan(0);
    }
  });
});

describe('spreads', () => {
  it('names every spread and the places it uses, in every language', () => {
    for (const s of SPREADS) {
      for (const lang of LANGS) {
        const [name, note] = TEXTS[lang].spreads[s.id];
        expect(name.length).toBeGreaterThan(1);
        expect(note.length).toBeGreaterThan(1);
        for (const place of [...(s.places ?? []), ...(s.rows ?? []), ...(s.cols ?? [])]) {
          expect(TEXTS[lang].places[place].length).toBeGreaterThan(1);
        }
      }
    }
  });

  it('gives each card of a spread its own place, and labels match the layout', () => {
    for (const s of SPREADS) {
      expect(new Set(s.slots.map((p) => `${p.x},${p.y}`)).size).toBe(s.slots.length);
      if (s.places) expect(s.places).toHaveLength(s.slots.length);
      if (s.rows) expect(s.rows).toHaveLength(new Set(s.slots.map((p) => p.y)).size);
      if (s.cols) expect(s.cols).toHaveLength(new Set(s.slots.map((p) => p.x)).size);
      if (s.core !== undefined) expect(s.core).toBeLessThan(s.slots.length);
    }
  });
});

describe('the deck', () => {
  it('is the same for the same seed, and holds every card once', () => {
    const a = deckFor(12345);
    const b = deckFor(12345);
    expect(a).toEqual(b);
    expect([...a.order].sort((x, y) => x - y)).toEqual(Array.from({ length: DECK_SIZE }, (_, c) => c));
    expect(deckFor(54321).order).not.toEqual(a.order);
  });

  it('is cut: the cards lifted off the top go underneath', () => {
    const { before, cut, order } = deckFor(777);
    expect(cut).toBeGreaterThan(0);
    expect(cut).toBeLessThan(DECK_SIZE);
    expect(order).toEqual([...before.slice(cut), ...before.slice(0, cut)]);
  });
});

describe('what the cards add up to', () => {
  it('answers yes or no by the colours', () => {
    const yesno = spread('yesno');
    expect(outcome(yesno, [makeCard(H, 0), makeCard(D, 1), makeCard(H, 2)])).toEqual({ kind: 'yesno', reds: 3 });
    expect(outcome(yesno, [makeCard(S, 0), makeCard(D, 1), makeCard(C, 2)])).toEqual({ kind: 'yesno', reds: 1 });
    expect(lean(yesno, [makeCard(H, 0), makeCard(D, 1), makeCard(C, 2)])).toBe(1);
    expect(lean(yesno, [makeCard(S, 0), makeCard(S, 1), makeCard(H, 2)])).toBe(-1);
  });

  it('answers a wish by the suit of its card', () => {
    expect(outcome(spread('wish'), [makeCard(C, 4)])).toEqual({ kind: 'wish', suit: C });
    expect(lean(spread('wish'), [makeCard(H, 4)])).toBe(1);
    expect(lean(spread('wish'), [makeCard(S, 4)])).toBe(-1);
  });

  it('names the suit that leads a gypsy spread, and none on a tie', () => {
    const gypsy = spread('gypsy');
    const four = [0, 1, 2, 3].map((r) => makeCard(H, r));
    expect(outcome(gypsy, [...four, makeCard(S, 0), makeCard(S, 1), makeCard(D, 0), makeCard(C, 0), makeCard(C, 1)])).toEqual({
      kind: 'suits',
      lead: H,
    });
    const tied = [makeCard(H, 0), makeCard(H, 1), makeCard(S, 0), makeCard(S, 1), makeCard(D, 0), makeCard(D, 1), makeCard(C, 0), makeCard(C, 1), makeCard(C, 2)];
    expect(outcome(gypsy, tied)).toEqual({ kind: 'suits', lead: C });
    tied[8] = makeCard(H, 2);
    tied[7] = makeCard(S, 2);
    expect(outcome(gypsy, tied)).toEqual({ kind: 'suits', lead: null });
  });

  it('weighs Lenormand cards bright against dark', () => {
    const sun = EMBLEMS[30].card;
    const coffin = EMBLEMS[7].card;
    const letter = EMBLEMS[26].card;
    expect(outcome(spread('line3'), [sun, coffin, letter])).toEqual({ kind: 'tones', sum: 0 });
    expect(lean(spread('line3'), [sun, letter, letter])).toBe(1);
    expect(lean(spread('line3'), [coffin, letter, letter])).toBe(-1);
  });

  it('has no rule for a single card of the day', () => {
    expect(outcome(spread('day'), [makeCard(H, 3)])).toBeNull();
  });
});

describe('shared readings', () => {
  it('come back from their link as they were', () => {
    const s = spread('gypsy');
    const text = encodeReading(s, 4294967295, [0, 35, 7, 12, 3, 30, 18, 21, 9]);
    expect(decodeReading(text)).toEqual({ spread: s, seed: 4294967295, picks: [0, 35, 7, 12, 3, 30, 18, 21, 9] });
  });

  it('are refused when the link is not one', () => {
    expect(decodeReading('nope.1.2')).toBeNull(); // no such spread
    expect(decodeReading('three.1.01')).toBeNull(); // too few cards
    expect(decodeReading('three.1.011')).toBeNull(); // the same card twice
    expect(decodeReading('day.zzzzzzz.0')).toBeNull(); // a seed out of range
    expect(decodeReading('day.1.<')).toBeNull();
  });
});

describe('the fortune-tellers', () => {
  it('each have a face, a name and a word about them in every language', () => {
    expect(new Set(TELLERS.map((x) => x.id)).size).toBe(TELLERS.length);
    for (const x of TELLERS) {
      expect(portraitUrl(x)).toMatch(new RegExp(`/${x.id}/neutral_[0-9][.]webp$`));
      for (const lang of LANGS) {
        expect(x.name[lang].length).toBeGreaterThan(1);
        expect(x.tag[lang].length).toBeGreaterThan(1);
      }
    }
  });

  it('shuffle in a picture of their own, or think while they do', () => {
    expect(tellerPicture(tellerById('izergil'), 'shuffle')).toMatch(/\/izergil\/shuffle_\d\.webp$/);
    expect(tellerPicture(tellerById('carmen'), 'shuffle')).toMatch(/\/carmen\/thinking_\d\.webp$/);
  });

  it('falls back to the first for an id no longer in the roster', () => {
    expect(tellerById('nobody')).toBe(TELLERS[0]);
  });

  it('have their own lines in every language, and a line for every moment', () => {
    expect(Object.keys(OWN_LINES).sort()).toEqual(TELLERS.map((x) => x.id).sort());
    for (const own of Object.values(OWN_LINES)) {
      const moments = Object.keys(own.ru).sort();
      for (const lang of LANGS) expect(Object.keys(own[lang]).sort()).toEqual(moments);
    }
    for (const x of TELLERS) {
      for (const lang of LANGS) {
        for (const line of Object.keys(LINES[lang]) as Line[]) expect(lineFor(x.id, line, lang).length).toBeGreaterThan(1);
      }
    }
  });
});
