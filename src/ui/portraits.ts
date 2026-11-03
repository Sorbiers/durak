import pictures from 'virtual:portraits';
import { Character, Mood } from './characters';
import { ROOT } from './root';

// A character's pictures are public/avatars/<id>/<mood>_<0..9>.webp, as many for each mood as are
// there. A mood with none shows them neutral. Some have a second view of themselves as well, in
// <id>/2/, taken from further off; the roster shows their own, and a click on their portrait at
// the table switches between the two.

function urls(view: string, mood: Mood): string[] {
  const found = pictures[view]?.[mood];
  if (found) return found.map((n) => `${ROOT}avatars/${view}/${mood}_${n}.webp`);
  return mood === 'neutral' ? [] : urls(view, 'neutral');
}

/** The folders a character's pictures are in, their own first and then any further views. */
export const viewsOf = (c: Character): string[] => [
  c.id,
  ...Object.keys(pictures)
    .filter((view) => view.startsWith(`${c.id}/`))
    .sort(),
];

/** The picture that stands for a character, or for one view of them: the first neutral one. */
export const portraitUrl = (c: Character, view = c.id): string => urls(view, 'neutral')[0]!;

/**
 * One of a character's pictures for a mood, at random, but not the one it showed last time. It is
 * taken from their own folder unless another of their views is given.
 */
export function pickPicture(c: Character, mood: Mood, last?: string, view = c.id): string {
  const all = urls(view, mood);
  const choices = all.length > 1 ? all.filter((url) => url !== last) : all;
  return choices[(Math.random() * choices.length) | 0]!;
}

/** Fetches the pictures of a character, in one view, ahead of time so a change of mood does not flicker. */
export function preloadAvatars(c: Character, view = c.id): void {
  for (const mood of Object.keys(pictures[view] ?? {}) as Mood[]) {
    for (const url of urls(view, mood)) new Image().src = url;
  }
}
