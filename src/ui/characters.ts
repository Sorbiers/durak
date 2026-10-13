import { Rating } from '../ai';
import { Lang } from './i18n';

export type Mood =
  | 'neutral'
  | 'thinking'
  | 'pleased'
  | 'happy'
  | 'surprised'
  | 'sad'
  | 'angry'
  | 'worried';

export interface Character {
  id: string; // also the folder under public/avatars
  name: Record<Lang, string>;
  style: 'real' | 'cartoon';
  rating: Rating;
  female: boolean; // for choosing a voice
  pitch: number; // voice pitch, 0..2, to tell the speakers apart
  // Which of the nine pictures (0..8, row by row on the original sheet) shows each mood.
  moods: Record<Mood, number>;
}

// Ordered from the strongest down. Boris is the only one at the top rating.
export const CHARACTERS: Character[] = [
  {
    id: 'boris',
    name: { ru: 'Борис', en: 'Boris' },
    style: 'real',
    rating: 5,
    female: false,
    pitch: 0.7,
    moods: { neutral: 0, thinking: 3, pleased: 4, happy: 5, surprised: 1, sad: 6, angry: 0, worried: 7 },
  },
  {
    id: 'vera',
    name: { ru: 'Вера', en: 'Vera' },
    style: 'real',
    rating: 4,
    female: true,
    pitch: 1.1,
    moods: { neutral: 4, thinking: 1, pleased: 5, happy: 0, surprised: 3, sad: 2, angry: 6, worried: 7 },
  },
  {
    id: 'lev',
    name: { ru: 'Лев', en: 'Lev' },
    style: 'cartoon',
    rating: 4,
    female: false,
    pitch: 0.55,
    moods: { neutral: 3, thinking: 0, pleased: 3, happy: 6, surprised: 4, sad: 7, angry: 8, worried: 2 },
  },
  {
    id: 'gleb',
    name: { ru: 'Глеб', en: 'Gleb' },
    style: 'real',
    rating: 3,
    female: false,
    pitch: 0.95,
    moods: { neutral: 8, thinking: 4, pleased: 7, happy: 3, surprised: 2, sad: 5, angry: 6, worried: 6 },
  },
  {
    id: 'tamara',
    name: { ru: 'Тамара', en: 'Tamara' },
    style: 'cartoon',
    rating: 3,
    female: true,
    pitch: 0.85,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 1 },
  },
  {
    id: 'anton',
    name: { ru: 'Антон', en: 'Anton' },
    style: 'cartoon',
    rating: 3,
    female: false,
    pitch: 1.05,
    moods: { neutral: 0, thinking: 7, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 1 },
  },
  {
    id: 'fyodor',
    name: { ru: 'Фёдор', en: 'Fyodor' },
    style: 'cartoon',
    rating: 2,
    female: false,
    pitch: 0.6,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 1 },
  },
  {
    id: 'lyuba',
    name: { ru: 'Люба', en: 'Lyuba' },
    style: 'cartoon',
    rating: 2,
    female: true,
    pitch: 1.35,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 7 },
  },
  {
    id: 'kostya',
    name: { ru: 'Костя', en: 'Kostya' },
    style: 'cartoon',
    rating: 1,
    female: false,
    pitch: 1.3,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 1, surprised: 4, sad: 5, angry: 8, worried: 7 },
  },
];

export const characterById = (id: string): Character =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export const avatarUrl = (c: Character, mood: Mood): string =>
  `${import.meta.env.BASE_URL}avatars/${c.id}/${c.moods[mood]}.webp`;

/** Fetches a character's pictures ahead of time so a change of mood does not flicker. */
export function preloadAvatars(c: Character): void {
  for (const index of new Set(Object.values(c.moods))) {
    new Image().src = `${import.meta.env.BASE_URL}avatars/${c.id}/${index}.webp`;
  }
}
