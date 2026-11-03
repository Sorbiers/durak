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
  id: string; // also the folder under public/avatars, where portraits.ts finds their pictures
  name: Record<Lang, string>;
  style: 'real' | 'cartoon' | 'fable';
  rating: Rating;
  female: boolean; // for choosing a voice
  pitch: number; // voice pitch, 0..2, to tell the speakers apart
  // A short film of them, as a sheet of square frames, row by row, in clip.webp beside the
  // pictures. `zoom` is how far into their neutral picture its first frame looks, as a scale and
  // a CSS background position in percent.
  clip?: { frames: number; columns: number; fps: number; zoom: { scale: number; x: number; y: number } };
  // A pipe they smoke, played the way a clip is: `picture` is the one with the pipe in their mouth,
  // and x and y are where its bowl is, in percent of that picture.
  smoke?: { picture: string; x: number; y: number };
}

// Ordered from the strongest down.
export const CHARACTERS: Character[] = [
  {
    id: 'boris',
    name: { ru: 'Борис', en: 'Boris', fr: 'Boris' },
    style: 'real',
    rating: 5,
    female: false,
    pitch: 0.7,
  },
  {
    id: 'sasha',
    name: { ru: 'Саша', en: 'Alex', fr: 'Alex' },
    style: 'real',
    rating: 5,
    female: false,
    pitch: 1.15,
  },
  {
    id: 'professor',
    name: { ru: 'Профессор', en: 'Professor', fr: 'Professeur' },
    style: 'cartoon',
    rating: 5,
    female: false,
    pitch: 0.8,
    smoke: { picture: 'neutral_0', x: 35.5, y: 45.5 },
  },
  {
    id: 'kruchyony',
    name: { ru: 'Кручёный', en: 'Twister', fr: 'Tordu' },
    style: 'cartoon',
    rating: 5,
    female: false,
    pitch: 0.7,
  },
  {
    id: 'fagot',
    name: { ru: 'Фагот', en: 'Koroviev', fr: 'Fagot' },
    style: 'fable',
    rating: 5,
    female: false,
    pitch: 1.4,
  },
  {
    id: 'satyr',
    name: { ru: 'Леший', en: 'Satyr', fr: 'Satyre' },
    style: 'fable',
    rating: 5,
    female: false,
    pitch: 1.15,
    clip: { frames: 120, columns: 8, fps: 12, zoom: { scale: 1.349, x: 50.1, y: 8.3 } },
  },
  {
    id: 'vera',
    name: { ru: 'Вера', en: 'Vera', fr: 'Véra' },
    style: 'real',
    rating: 4,
    female: true,
    pitch: 1.1,
  },
  {
    id: 'rita',
    name: { ru: 'Рита', en: 'Rita', fr: 'Rita' },
    style: 'real',
    rating: 4,
    female: true,
    pitch: 0.95,
  },
  {
    id: 'lev',
    name: { ru: 'Лев', en: 'Lev', fr: 'Lev' },
    style: 'cartoon',
    rating: 4,
    female: false,
    pitch: 0.55,
  },
  {
    id: 'koshchei',
    name: { ru: 'Кощей', en: 'Koshchei', fr: 'Kochtcheï' },
    style: 'fable',
    rating: 4,
    female: false,
    pitch: 0.5,
  },
  {
    id: 'yaga',
    name: { ru: 'Яга', en: 'Yaga', fr: 'Yaga' },
    style: 'fable',
    rating: 4,
    female: true,
    pitch: 0.75,
  },
  {
    id: 'gleb',
    name: { ru: 'Глеб', en: 'Gleb', fr: 'Gleb' },
    style: 'real',
    rating: 3,
    female: false,
    pitch: 0.95,
  },
  {
    id: 'ivan',
    name: { ru: 'Иван', en: 'Ivan', fr: 'Ivan' },
    style: 'real',
    rating: 3,
    female: false,
    pitch: 0.9,
  },
  {
    id: 'masha',
    name: { ru: 'Маша', en: 'Mary', fr: 'Marie' },
    style: 'real',
    rating: 3,
    female: true,
    pitch: 1.0,
  },
  {
    id: 'tamara',
    name: { ru: 'Тамара', en: 'Tamara', fr: 'Tamara' },
    style: 'cartoon',
    rating: 3,
    female: true,
    pitch: 0.85,
  },
  {
    id: 'anton',
    name: { ru: 'Антон', en: 'Anton', fr: 'Anton' },
    style: 'cartoon',
    rating: 3,
    female: false,
    pitch: 1.05,
  },
  {
    id: 'byvaly',
    name: { ru: 'Бывалый', en: 'Old Hand', fr: 'Briscard' },
    style: 'cartoon',
    rating: 3,
    female: false,
    pitch: 0.6,
  },
  {
    id: 'begemot',
    name: { ru: 'Бегемот', en: 'Begemot', fr: 'Béhémoth' },
    style: 'fable',
    rating: 3,
    female: false,
    pitch: 0.65,
  },
  {
    id: 'azazello',
    name: { ru: 'Азазелло', en: 'Azazello', fr: 'Azazello' },
    style: 'fable',
    rating: 3,
    female: false,
    pitch: 0.8,
  },
  {
    id: 'morkott',
    name: { ru: 'Моркот', en: 'Morkott', fr: 'Morkott' },
    style: 'fable',
    rating: 3,
    female: false,
    pitch: 0.9,
  },
  {
    id: 'sonya',
    name: { ru: 'Соня', en: 'Sonya', fr: 'Sonia' },
    style: 'real',
    rating: 2,
    female: true,
    pitch: 1.2,
  },
  {
    id: 'max',
    name: { ru: 'Макс', en: 'Max', fr: 'Max' },
    style: 'real',
    rating: 2,
    female: false,
    pitch: 0.75,
  },
  {
    id: 'fyodor',
    name: { ru: 'Фёдор', en: 'Fyodor', fr: 'Fiodor' },
    style: 'cartoon',
    rating: 2,
    female: false,
    pitch: 0.6,
  },
  {
    id: 'lyuba',
    name: { ru: 'Люба', en: 'Lyuba', fr: 'Liouba' },
    style: 'cartoon',
    rating: 2,
    female: true,
    pitch: 1.35,
  },
  {
    id: 'boss',
    name: { ru: 'Босс', en: 'Boss', fr: 'Boss' },
    style: 'cartoon',
    rating: 2, // everyone always let him win, so he never learned
    female: false,
    pitch: 0.5,
  },
  {
    id: 'kikimora',
    name: { ru: 'Кикимора', en: 'Kikimora', fr: 'Kikimora' },
    style: 'fable',
    rating: 2,
    female: true,
    pitch: 1.25,
  },
  {
    id: 'kostya',
    name: { ru: 'Костя', en: 'Kostya', fr: 'Kostia' },
    style: 'cartoon',
    rating: 1,
    female: false,
    pitch: 1.3,
  },
];

export const characterById = (id: string): Character =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export const clipUrl = (c: Character): string => `${ROOT}avatars/${c.id}/clip.webp`;
