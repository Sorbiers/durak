import { Rating } from '../ai';
import { Lang } from './i18n';
import { ROOT } from './root';

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
  id: string; // also the folder under public/durak/avatars
  name: Record<Lang, string>;
  style: 'real' | 'cartoon' | 'fable';
  rating: Rating;
  female: boolean; // for choosing a voice
  pitch: number; // voice pitch, 0..2, to tell the speakers apart
  // Which of the nine pictures (0..8, row by row on the original sheet, or in mood order where
  // they were chosen from several sheets) shows each mood.
  moods: Record<Mood, number>;
  // A short film of them, as a sheet of square frames, row by row, in clip.webp beside the
  // pictures. It starts and ends on their neutral picture.
  clip?: { frames: number; columns: number; fps: number };
}

// Ordered from the strongest down. Boris is the only one at the top rating.
export const CHARACTERS: Character[] = [
  {
    id: 'boris',
    name: { ru: 'Борис', en: 'Boris', fr: 'Boris' },
    style: 'real',
    rating: 5,
    female: false,
    pitch: 0.7,
    moods: { neutral: 8, thinking: 4, pleased: 7, happy: 3, surprised: 2, sad: 5, angry: 6, worried: 6 },
  },
  {
    id: 'vera',
    name: { ru: 'Вера', en: 'Vera', fr: 'Véra' },
    style: 'real',
    rating: 4,
    female: true,
    pitch: 1.1,
    moods: { neutral: 4, thinking: 1, pleased: 5, happy: 0, surprised: 3, sad: 2, angry: 6, worried: 7 },
  },
  {
    id: 'lev',
    name: { ru: 'Лев', en: 'Lev', fr: 'Lev' },
    style: 'cartoon',
    rating: 4,
    female: false,
    pitch: 0.55,
    moods: { neutral: 3, thinking: 0, pleased: 3, happy: 6, surprised: 4, sad: 7, angry: 8, worried: 2 },
  },
  {
    id: 'koshchei',
    name: { ru: 'Кощей', en: 'Koshchei', fr: 'Kochtcheï' },
    style: 'fable',
    rating: 4,
    female: false,
    pitch: 0.5,
    moods: { neutral: 0, thinking: 1, pleased: 2, happy: 3, surprised: 4, sad: 5, angry: 6, worried: 7 },
  },
  {
    id: 'yaga',
    name: { ru: 'Яга', en: 'Yaga', fr: 'Yaga' },
    style: 'fable',
    rating: 4,
    female: true,
    pitch: 0.75,
    moods: { neutral: 0, thinking: 1, pleased: 2, happy: 3, surprised: 4, sad: 5, angry: 6, worried: 7 },
  },
  {
    id: 'fagot',
    name: { ru: 'Фагот', en: 'Koroviev', fr: 'Fagot' },
    style: 'fable',
    rating: 4,
    female: false,
    pitch: 1.4,
    moods: { neutral: 0, thinking: 1, pleased: 2, happy: 4, surprised: 6, sad: 8, angry: 3, worried: 5 },
  },
  {
    id: 'gleb',
    name: { ru: 'Глеб', en: 'Gleb', fr: 'Gleb' },
    style: 'real',
    rating: 3,
    female: false,
    pitch: 0.95,
    moods: { neutral: 0, thinking: 3, pleased: 4, happy: 5, surprised: 1, sad: 6, angry: 0, worried: 7 },
  },
  {
    id: 'tamara',
    name: { ru: 'Тамара', en: 'Tamara', fr: 'Tamara' },
    style: 'cartoon',
    rating: 3,
    female: true,
    pitch: 0.85,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 1 },
  },
  {
    id: 'anton',
    name: { ru: 'Антон', en: 'Anton', fr: 'Anton' },
    style: 'cartoon',
    rating: 3,
    female: false,
    pitch: 1.05,
    moods: { neutral: 0, thinking: 7, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 1 },
  },
  {
    id: 'begemot',
    name: { ru: 'Бегемот', en: 'Begemot', fr: 'Béhémoth' },
    style: 'fable',
    rating: 3,
    female: false,
    pitch: 0.65,
    moods: { neutral: 8, thinking: 1, pleased: 4, happy: 0, surprised: 3, sad: 6, angry: 7, worried: 5 },
  },
  {
    id: 'azazello',
    name: { ru: 'Азазелло', en: 'Azazello', fr: 'Azazello' },
    style: 'fable',
    rating: 3,
    female: false,
    pitch: 0.8,
    moods: { neutral: 5, thinking: 0, pleased: 1, happy: 8, surprised: 4, sad: 6, angry: 2, worried: 7 },
  },
  {
    id: 'matroskin',
    name: { ru: 'Матроскин', en: 'Matroskin', fr: 'Matroskine' },
    style: 'fable',
    rating: 3,
    female: false,
    pitch: 0.9,
    moods: { neutral: 0, thinking: 3, pleased: 5, happy: 8, surprised: 4, sad: 6, angry: 7, worried: 2 },
  },
  {
    id: 'fyodor',
    name: { ru: 'Фёдор', en: 'Fyodor', fr: 'Fiodor' },
    style: 'cartoon',
    rating: 2,
    female: false,
    pitch: 0.6,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 1 },
  },
  {
    id: 'lyuba',
    name: { ru: 'Люба', en: 'Lyuba', fr: 'Liouba' },
    style: 'cartoon',
    rating: 2,
    female: true,
    pitch: 1.35,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 6, surprised: 4, sad: 5, angry: 8, worried: 7 },
  },
  {
    id: 'kikimora',
    name: { ru: 'Кикимора', en: 'Kikimora', fr: 'Kikimora' },
    style: 'fable',
    rating: 2,
    female: true,
    pitch: 1.25,
    moods: { neutral: 0, thinking: 1, pleased: 2, happy: 3, surprised: 4, sad: 5, angry: 6, worried: 7 },
  },
  {
    id: 'kostya',
    name: { ru: 'Костя', en: 'Kostya', fr: 'Kostia' },
    style: 'cartoon',
    rating: 1,
    female: false,
    pitch: 1.3,
    moods: { neutral: 0, thinking: 2, pleased: 3, happy: 1, surprised: 4, sad: 5, angry: 8, worried: 7 },
  },
  {
    id: 'satyr',
    name: { ru: 'Сатир', en: 'Satyr', fr: 'Satyre' },
    style: 'fable',
    rating: 1,
    female: false,
    pitch: 1.15,
    moods: { neutral: 4, thinking: 2, pleased: 0, happy: 3, surprised: 6, sad: 5, angry: 1, worried: 8 },
    clip: { frames: 120, columns: 8, fps: 12 },
  },
];

export const characterById = (id: string): Character =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export const avatarUrl = (c: Character, mood: Mood): string =>
  `${ROOT}avatars/${c.id}/${c.moods[mood]}.webp`;

export const clipUrl = (c: Character): string => `${ROOT}avatars/${c.id}/clip.webp`;

/** Fetches a character's pictures ahead of time so a change of mood does not flicker. */
export function preloadAvatars(c: Character): void {
  for (const index of new Set(Object.values(c.moods))) {
    new Image().src = `${ROOT}avatars/${c.id}/${index}.webp`;
  }
}
