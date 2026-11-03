import pictures from 'virtual:portraits';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, Mood, characterById } from '../src/ui/characters';
import { pickPicture, portraitUrl, viewsOf } from '../src/ui/portraits';

const MOODS: Mood[] = ['neutral', 'thinking', 'pleased', 'happy', 'surprised', 'sad', 'angry', 'worried'];

describe('portraits', () => {
  it('finds a neutral picture for every character', () => {
    for (const c of CHARACTERS) expect(portraitUrl(c)).toMatch(new RegExp(`/${c.id}/neutral_\\d\\.webp$`));
  });

  it('names a picture of the mood, or a neutral one where the mood has none', () => {
    for (const c of CHARACTERS) {
      for (const mood of MOODS) {
        expect(pickPicture(c, mood)).toMatch(new RegExp(`/${c.id}/(${mood}|neutral)_\\d\\.webp$`));
      }
    }
  });

  it('keeps the pictures of a second view to its own folder', () => {
    for (const id of ['rita', 'sonya', 'sasha']) {
      const c = characterById(id);
      expect(viewsOf(c)).toEqual([id, `${id}/2`]);
      expect(portraitUrl(c, `${id}/2`)).toMatch(new RegExp(`/${id}/2/neutral_\\d\\.webp$`));
      for (const mood of MOODS) {
        expect(pickPicture(c, mood, undefined, `${id}/2`)).toMatch(new RegExp(`/${id}/2/(${mood}|neutral)_\\d\\.webp$`));
      }
    }
    expect(viewsOf(characterById('boris'))).toEqual(['boris']);
  });

  it('finds the picture a pipe smoker smokes in, with the bowl on it', () => {
    const smokers = CHARACTERS.filter((c) => c.smoke);
    expect(smokers.map((c) => c.id)).toContain('professor');
    for (const c of smokers) {
      const [, mood, n] = /^([a-z]+)_(\d)$/.exec(c.smoke!.picture)!;
      expect(pictures[c.id]?.[mood!]).toContain(Number(n));
      for (const at of [c.smoke!.x, c.smoke!.y]) {
        expect(at).toBeGreaterThan(0);
        expect(at).toBeLessThan(100);
      }
    }
  });

  it('does not show the same picture twice running where there are several', () => {
    for (const c of CHARACTERS) {
      for (const mood of MOODS) {
        const seen = new Set<string>();
        let last = pickPicture(c, mood);
        seen.add(last);
        for (let i = 0; i < 200; i++) {
          const next = pickPicture(c, mood, last);
          if (seen.size > 1) expect(next).not.toBe(last);
          seen.add(next);
          last = next;
        }
      }
    }
  });
});
