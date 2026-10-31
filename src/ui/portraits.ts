import pictures from 'virtual:portraits';
import { Character, Mood } from './characters';
import { ROOT } from './root';

// A character's pictures are public/avatars/<id>/<mood>_<0..9>.webp, as many for each mood as are
// there. A mood with none shows them neutral.

function urls(c: Character, mood: Mood): string[] {
  const found = pictures[c.id]?.[mood];
  if (found) return found.map((n) => `${ROOT}avatars/${c.id}/${mood}_${n}.webp`);
  return mood === 'neutral' ? [] : urls(c, 'neutral');
}

/** The picture that stands for a character outside a game: their first neutral one. */
export const portraitUrl = (c: Character): string => urls(c, 'neutral')[0]!;

/** One of a character's pictures for a mood, at random, but not the one it showed last time. */
export function pickPicture(c: Character, mood: Mood, last?: string): string {
  const all = urls(c, mood);
  const choices = all.length > 1 ? all.filter((url) => url !== last) : all;
  return choices[(Math.random() * choices.length) | 0]!;
}

/** Fetches a character's pictures ahead of time so a change of mood does not flicker. */
export function preloadAvatars(c: Character): void {
  for (const mood of Object.keys(pictures[c.id] ?? {}) as Mood[]) {
    for (const url of urls(c, mood)) new Image().src = url;
  }
}
