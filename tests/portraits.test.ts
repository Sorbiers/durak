import { describe, expect, it } from 'vitest';
import { CHARACTERS, Mood } from '../src/ui/characters';
import { pickPicture, portraitUrl } from '../src/ui/portraits';

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
