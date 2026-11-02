import pictures from 'virtual:portraits';
import { Character, Mood } from '../ui/characters';
import { Lang } from '../ui/i18n';
import { pickPicture } from '../ui/portraits';

// The fortune-tellers to choose from. Their pictures are in public/avatars/<id>/, like the
// opponents' in the game: the game's moods, and one of their own, `shuffle`, for while they
// shuffle the cards. Carmen is Mérimée's, who read the cards; Izergil is Gorky's old woman.

export interface Teller extends Character {
  tag: Record<Lang, string>; // a few words about her, under her name
}

export const TELLERS: Teller[] = [
  {
    id: 'rada',
    name: { ru: 'Рада', en: 'Rada', fr: 'Rada' },
    tag: { ru: 'Молодая и ласковая', en: 'Young and kind', fr: 'Jeune et douce' },
    style: 'real',
    rating: 3, // they do not play; a character in the game's roster needs a strength
    female: true,
    pitch: 1.05,
  },
  {
    id: 'carmen',
    name: { ru: 'Кармен', en: 'Carmen', fr: 'Carmen' },
    tag: { ru: 'Верит в судьбу', en: 'Believes in fate', fr: 'Croit au destin' },
    style: 'cartoon',
    rating: 3,
    female: true,
    pitch: 0.9,
  },
  {
    id: 'izergil',
    name: { ru: 'Изергиль', en: 'Izergil', fr: 'Izerguil' },
    tag: { ru: 'Старая и мудрая', en: 'Old and wise', fr: 'Vieille et sage' },
    style: 'real',
    rating: 3,
    female: true,
    pitch: 0.7,
  },
];

export const tellerById = (id: string): Teller => TELLERS.find((t) => t.id === id) ?? TELLERS[0];

export type TellerMood = Mood | 'shuffle';

/**
 * One of her pictures for a mood, not the one shown last time. Moods are found by file name;
 * one who has no picture of herself shuffling is thinking instead.
 */
export function tellerPicture(teller: Teller, mood: TellerMood, last?: string): string {
  const shown = mood === 'shuffle' && !pictures[teller.id]?.shuffle ? 'thinking' : mood;
  return pickPicture(teller, shown as Mood, last);
}
