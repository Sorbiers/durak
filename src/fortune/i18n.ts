import { Lang } from '../ui/i18n';
import { Place, SystemId } from './spreads';

// The fortune-telling page's texts, and what the reader says.

interface Texts {
  title: string;
  about: string;
  close: string;
  durak: string; // the link to the game
  newReading: string;
  voiceOn: string;
  voiceOff: string;
  teller: string;
  systems: Record<SystemId, [name: string, note: string]>;
  spreads: Record<string, [name: string, note: string]>;
  places: Record<Place, string>;
  question: string;
  begin: string;
  shuffling: string;
  cut: string;
  pickOne: string;
  pick: string; // {left} {total}
  reveal: string;
  turnAll: string;
  again: string;
  other: string;
  share: string;
  copied: string;
  shared: string;
  answered: string;
  showIt: string;
  anyway: string;
  yesno: [no: string, rather: string, ratherYes: string, yes: string];
  reds: string; // {n}
  balanced: string;
  bright: string;
  dark: string;
  even: string;
  core: string;
  ranks: string[]; // the index in the corner of a card
  cardName: (rank: number, suit: number) => string;
}

const RU_RANKS = ['Шестёрка', 'Семёрка', 'Восьмёрка', 'Девятка', 'Десятка', 'Валет', 'Дама', 'Король', 'Туз'];
const RU_SUITS = ['пик', 'червей', 'бубен', 'треф'];
const EN_RANKS = ['Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const EN_SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const FR_RANKS = ['Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Valet', 'Dame', 'Roi', 'As'];
const FR_SUITS = ['pique', 'cœur', 'carreau', 'trèfle'];

export const TEXTS: Record<Lang, Texts> = {
  ru: {
    title: 'Гадание',
    about: 'О гадании',
    close: 'Закрыть',
    durak: 'Дурак',
    newReading: 'Новый расклад',
    voiceOn: 'Голос: вкл',
    voiceOff: 'Голос: выкл',
    teller: 'Гадалка',
    systems: {
      russian: ['Игральные карты', 'Русская традиция: колода из 36 карт, у каждой карты своё значение.'],
      lenormand: [
        'Ленорман',
        'Оракул Ленорман на обычной колоде: у каждой из 36 карт свой образ — Всадник, Клевер, Корабль…',
      ],
    },
    spreads: {
      day: ['Карта дня', 'Одна карта на сегодняшний день.'],
      yesno: ['Да или нет', 'Три карты: красные говорят «да», чёрные — «нет».'],
      wish: ['На желание', 'Загадайте желание — ответит масть одной карты.'],
      three: ['Прошлое, настоящее, будущее', 'Три карты в ряд.'],
      gypsy: ['Цыганский расклад', 'Девять карт в три ряда: прошлое, настоящее, будущее.'],
      lday: ['Карта дня', 'Один образ на сегодняшний день.'],
      line3: ['Линия из трёх', 'Читается как фраза: суть, развитие, итог.'],
      line5: ['Линия из пяти', 'В центре — суть дела, слева — что к ней привело, справа — куда она ведёт.'],
      box: ['Квадрат девяти', 'Три на три; центральная карта — суть дела.'],
    },
    places: {
      day: 'Сегодня',
      wish: 'Желание',
      past: 'Прошлое',
      present: 'Настоящее',
      future: 'Будущее',
      subject: 'Суть',
      development: 'Развитие',
      outcome: 'Итог',
      recent: 'Недавнее',
      core: 'Суть дела',
      soon: 'Скоро',
    },
    question: 'Ваш вопрос (необязательно; он остаётся на этом устройстве)',
    begin: 'Тасовать',
    shuffling: '{name} тасует карты…',
    cut: 'Сдвиньте колоду: нажмите на неё.',
    pickOne: 'Выберите одну карту.',
    pick: 'Выберите карту: осталось {left} из {total}.',
    reveal: 'Переворачивайте карты по одной.',
    turnAll: 'Открыть все',
    again: 'Ещё раз',
    other: 'Другой расклад',
    share: 'Скопировать ссылку',
    copied: 'Ссылка скопирована.',
    shared: 'Расклад, которым с вами поделились.',
    answered: 'Сегодня карты уже ответили на этот расклад.',
    showIt: 'Показать его',
    anyway: 'Разложить заново',
    yesno: ['Нет.', 'Скорее нет.', 'Скорее да.', 'Да.'],
    reds: 'Красных карт: {n} из трёх.',
    balanced: 'Масти в равновесии: ничто не перевешивает.',
    bright: 'Карты светлые: всё складывается в вашу пользу.',
    dark: 'Карты тёмные: будьте осторожны и не торопитесь.',
    even: 'Света и тени поровну: многое зависит от вас.',
    core: 'суть дела',
    ranks: ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'],
    cardName: (rank, suit) => `${RU_RANKS[rank]} ${RU_SUITS[suit]}`,
  },
  en: {
    title: 'Fortune-telling',
    about: 'About',
    close: 'Close',
    durak: 'Durak',
    newReading: 'New reading',
    voiceOn: 'Voice: on',
    voiceOff: 'Voice: off',
    teller: 'Fortune-teller',
    systems: {
      russian: ['Playing cards', 'The Russian tradition: a 36-card deck in which every card has a meaning of its own.'],
      lenormand: [
        'Lenormand',
        'The Lenormand oracle on an ordinary deck: each of the 36 cards stands for an emblem — the Rider, the Clover, the Ship…',
      ],
    },
    spreads: {
      day: ['Card of the day', 'One card for the day ahead.'],
      yesno: ['Yes or no', 'Three cards: red says yes, black says no.'],
      wish: ['Wish', 'Make a wish; the suit of one card answers.'],
      three: ['Past, present, future', 'Three cards in a row.'],
      gypsy: ['Gypsy spread', 'Nine cards in three rows: past, present, future.'],
      lday: ['Card of the day', 'One emblem for the day ahead.'],
      line3: ['Line of three', 'Read as a sentence: subject, development, outcome.'],
      line5: ['Line of five', 'The heart of the matter in the centre, what led to it on the left, where it goes on the right.'],
      box: ['Box of nine', 'Three by three; the centre card is the heart of the matter.'],
    },
    places: {
      day: 'Today',
      wish: 'Your wish',
      past: 'Past',
      present: 'Present',
      future: 'Future',
      subject: 'Subject',
      development: 'Development',
      outcome: 'Outcome',
      recent: 'Recent past',
      core: 'The heart of it',
      soon: 'Near future',
    },
    question: 'Your question (optional; it stays on this device)',
    begin: 'Shuffle',
    shuffling: '{name} is shuffling the cards…',
    cut: 'Cut the deck: click it.',
    pickOne: 'Pick one card.',
    pick: 'Pick a card: {left} of {total} left.',
    reveal: 'Turn the cards over, one by one.',
    turnAll: 'Turn all',
    again: 'Again',
    other: 'Another spread',
    share: 'Copy link',
    copied: 'Link copied.',
    shared: 'A reading someone shared with you.',
    answered: 'The cards have already answered this spread today.',
    showIt: 'Show it',
    anyway: 'Deal again',
    yesno: ['No.', 'Probably not.', 'Probably yes.', 'Yes.'],
    reds: 'Red cards: {n} of three.',
    balanced: 'The suits are balanced: nothing outweighs the rest.',
    bright: 'The cards are bright: things are going your way.',
    dark: 'The cards are dark: be careful and take your time.',
    even: 'Light and shade in equal measure: much depends on you.',
    core: 'the heart of it',
    ranks: ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'],
    cardName: (rank, suit) => `${EN_RANKS[rank]} of ${EN_SUITS[suit]}`,
  },
  fr: {
    title: 'Cartomancie',
    about: 'À propos',
    close: 'Fermer',
    durak: 'Dourak',
    newReading: 'Nouveau tirage',
    voiceOn: 'Voix : oui',
    voiceOff: 'Voix : non',
    teller: 'Cartomancienne',
    systems: {
      russian: ['Cartes à jouer', 'La tradition russe : un jeu de 36 cartes où chaque carte a son sens.'],
      lenormand: [
        'Lenormand',
        'L’oracle Lenormand sur un jeu ordinaire : chacune des 36 cartes porte un emblème — le Cavalier, le Trèfle, le Navire…',
      ],
    },
    spreads: {
      day: ['Carte du jour', 'Une carte pour la journée.'],
      yesno: ['Oui ou non', 'Trois cartes : le rouge dit oui, le noir dit non.'],
      wish: ['Le vœu', 'Faites un vœu ; la couleur d’une carte répond.'],
      three: ['Passé, présent, avenir', 'Trois cartes en ligne.'],
      gypsy: ['Tirage tzigane', 'Neuf cartes sur trois rangs : passé, présent, avenir.'],
      lday: ['Carte du jour', 'Un emblème pour la journée.'],
      line3: ['Ligne de trois', 'Se lit comme une phrase : le sujet, l’évolution, l’issue.'],
      line5: ['Ligne de cinq', 'Au centre, le cœur de l’affaire ; à gauche, ce qui y a mené ; à droite, où elle va.'],
      box: ['Carré de neuf', 'Trois sur trois ; la carte du centre est le cœur de l’affaire.'],
    },
    places: {
      day: 'Aujourd’hui',
      wish: 'Votre vœu',
      past: 'Passé',
      present: 'Présent',
      future: 'Avenir',
      subject: 'Le sujet',
      development: 'L’évolution',
      outcome: 'L’issue',
      recent: 'Passé récent',
      core: 'Le cœur',
      soon: 'Bientôt',
    },
    question: 'Votre question (facultatif ; elle reste sur cet appareil)',
    begin: 'Battre les cartes',
    shuffling: '{name} bat les cartes…',
    cut: 'Coupez le jeu : cliquez dessus.',
    pickOne: 'Choisissez une carte.',
    pick: 'Choisissez une carte : encore {left} sur {total}.',
    reveal: 'Retournez les cartes une à une.',
    turnAll: 'Tout retourner',
    again: 'Encore',
    other: 'Autre tirage',
    share: 'Copier le lien',
    copied: 'Lien copié.',
    shared: 'Un tirage que l’on a partagé avec vous.',
    answered: 'Les cartes ont déjà répondu à ce tirage aujourd’hui.',
    showIt: 'Le revoir',
    anyway: 'Retirer',
    yesno: ['Non.', 'Plutôt non.', 'Plutôt oui.', 'Oui.'],
    reds: 'Cartes rouges : {n} sur trois.',
    balanced: 'Les couleurs s’équilibrent : rien ne l’emporte.',
    bright: 'Les cartes sont lumineuses : les choses tournent en votre faveur.',
    dark: 'Les cartes sont sombres : avancez avec prudence et sans hâte.',
    even: 'Ombre et lumière à parts égales : beaucoup dépend de vous.',
    core: 'le cœur de l’affaire',
    ranks: ['6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'],
    cardName: (rank, suit) => `${FR_RANKS[rank]} de ${FR_SUITS[suit]}`,
  },
};

/** Moments when the fortune-teller says something. */
export type Line =
  | 'greet'
  | 'shuffle'
  | 'cut'
  | 'pick'
  | 'reveal'
  | 'good'
  | 'bad'
  | 'neutral'
  | 'best'
  | 'worst'
  | 'bright'
  | 'dark'
  | 'mixed'
  | 'answered';

export const LINES: Record<Lang, Record<Line, string[]>> = {
  ru: {
    greet: ['Здравствуй. Садись, погадаю.', 'Выбирай расклад — карты всё скажут.', 'Карты любят тишину. Выбирай.'],
    shuffle: ['Перетасую, а ты думай о своём.', 'Думай о вопросе, пока карты мешаются.'],
    cut: ['Сдвинь колоду. Левой рукой, к себе.'],
    pick: ['Тяни, не думай. Рука сама знает.', 'Выбирай сердцем.'],
    reveal: ['Ну, посмотрим, что легло.', 'Открывай, не бойся.'],
    good: ['Хорошая карта.', 'О, это к добру.', 'Вот это славно.'],
    bad: ['Хм… не самая лёгкая.', 'Тут надо быть осторожней.', 'Ох, эта карта с тенью.'],
    neutral: ['Так-так.', 'Интересно.', 'Запомним.'],
    best: ['Ах, какая карта!', 'Лучше и не придумать.'],
    worst: ['Ой… Эту карту не обойти.', 'Тяжёлая карта. Но это не приговор.'],
    bright: ['Светлый расклад. Иди с лёгким сердцем.'],
    dark: ['Карты предупреждают, а не приговаривают.'],
    mixed: ['Всего понемногу — как и в жизни.'],
    answered: ['Сегодня карты уже сказали. Не спрашивай дважды.'],
  },
  en: {
    greet: ['Hello. Sit down, I’ll read the cards for you.', 'Choose a spread; the cards will tell.', 'The cards like quiet. Choose.'],
    shuffle: ['I’ll shuffle; you think of your question.', 'Keep your question in mind while the cards mix.'],
    cut: ['Cut the deck. Left hand, towards you.'],
    pick: ['Draw, don’t think. Your hand knows.', 'Choose with your heart.'],
    reveal: ['Well, let’s see what fell.', 'Turn them over, don’t be afraid.'],
    good: ['A good card.', 'Oh, that bodes well.', 'Now that is lovely.'],
    bad: ['Hm… not an easy one.', 'Here you must be careful.', 'Oh, this card has a shadow.'],
    neutral: ['Well, well.', 'Interesting.', 'Let’s remember that one.'],
    best: ['Ah, what a card!', 'It couldn’t be better.'],
    worst: ['Oh… there’s no getting round this card.', 'A heavy card. But it is not a sentence.'],
    bright: ['A bright reading. Go with a light heart.'],
    dark: ['The cards warn; they do not condemn.'],
    mixed: ['A little of everything, as in life.'],
    answered: ['The cards have spoken today. Don’t ask twice.'],
  },
  fr: {
    greet: ['Bonjour. Assieds-toi, je vais te tirer les cartes.', 'Choisis un tirage ; les cartes parleront.', 'Les cartes aiment le silence. Choisis.'],
    shuffle: ['Je bats les cartes ; toi, pense à ta question.', 'Garde ta question en tête pendant que je mélange.'],
    cut: ['Coupe le jeu. De la main gauche, vers toi.'],
    pick: ['Tire, ne réfléchis pas. Ta main sait.', 'Choisis avec ton cœur.'],
    reveal: ['Voyons ce qui est tombé.', 'Retourne-les, n’aie pas peur.'],
    good: ['Une bonne carte.', 'Oh, c’est de bon augure.', 'Voilà qui est joli.'],
    bad: ['Hum… pas la plus facile.', 'Ici, il faut de la prudence.', 'Oh, cette carte a une ombre.'],
    neutral: ['Tiens, tiens.', 'Intéressant.', 'Retenons celle-là.'],
    best: ['Ah, quelle carte !', 'On ne pouvait rêver mieux.'],
    worst: ['Oh… impossible d’ignorer cette carte.', 'Une carte lourde. Mais ce n’est pas une condamnation.'],
    bright: ['Un tirage lumineux. Va le cœur léger.'],
    dark: ['Les cartes préviennent, elles ne condamnent pas.'],
    mixed: ['Un peu de tout, comme dans la vie.'],
    answered: ['Les cartes ont parlé aujourd’hui. Ne demande pas deux fois.'],
  },
};

type OwnLines = Record<Lang, Partial<Record<Line, string[]>>>;

/** What each fortune-teller says in her own way, besides the lines any of them might say. */
export const OWN_LINES: Record<string, OwnLines> = {
  rada: {
    ru: {
      greet: ['Здравствуй, милая душа. Садись поближе.'],
      best: ['Ой, как хорошо легло!'],
      bright: ['Улыбнись — карты на твоей стороне.'],
    },
    en: {
      greet: ['Hello, dear soul. Sit closer.'],
      best: ['Oh, how nicely that fell!'],
      bright: ['Smile: the cards are on your side.'],
    },
    fr: {
      greet: ['Bonjour, chère âme. Approche-toi.'],
      best: ['Oh, comme c’est bien tombé !'],
      bright: ['Souris : les cartes sont de ton côté.'],
    },
  },
  carmen: {
    ru: {
      greet: ['Хочешь знать судьбу? Карты не лгут.', 'Садись. От судьбы не уйдёшь, так хоть узнаешь её.'],
      shuffle: ['Тасуй не тасуй, а лягут они так, как суждено.'],
      best: ['Вот это судьба!'],
      worst: ['Карты сказали своё. Но спорить с судьбой — тоже судьба.'],
      bright: ['Свобода и любовь — что ещё нужно?'],
      dark: ['Судьбу не обманешь, но с ней можно поспорить.'],
    },
    en: {
      greet: ['Want to know your fate? The cards don’t lie.', 'Sit down. You can’t escape fate, but you can know it.'],
      shuffle: ['Shuffle as you like: they fall the way fate decides.'],
      best: ['Now that is fate!'],
      worst: ['The cards have said their piece. But arguing with fate is fate too.'],
      bright: ['Freedom and love: what more do you need?'],
      dark: ['You can’t cheat fate, but you can stand up to it.'],
    },
    fr: {
      greet: ['Tu veux connaître ton destin ? Les cartes ne mentent pas.', 'Assieds-toi. On n’échappe pas au destin, mais on peut le connaître.'],
      shuffle: ['Bats-les tant que tu veux : elles tombent comme le veut le destin.'],
      best: ['Ça, c’est le destin !'],
      worst: ['Les cartes ont parlé. Mais se battre contre le destin, c’est aussi le destin.'],
      bright: ['La liberté et l’amour : que veux-tu de plus ?'],
      dark: ['On ne trompe pas le destin, mais on peut lui tenir tête.'],
    },
  },
  izergil: {
    ru: {
      greet: ['Садись, садись. Я много видела на своём веку.', 'Старые карты не врут, дитя.'],
      shuffle: ['Не торопись. Карты любят терпение.'],
      best: ['Ох, давно я такой карты не видела.'],
      worst: ['Не пугайся. Всё проходит, и это пройдёт.'],
      bright: ['Хороший расклад. Вспомни его, когда будет трудно.'],
      dark: ['Жизнь длинная, дитя. Тёмные дни тоже кончаются.'],
    },
    en: {
      greet: ['Sit, sit. I have seen a great deal in my time.', 'Old cards don’t lie, child.'],
      shuffle: ['Don’t hurry. The cards like patience.'],
      best: ['Oh, I haven’t seen a card like that in a long while.'],
      worst: ['Don’t be frightened. Everything passes, and so will this.'],
      bright: ['A good reading. Remember it when times are hard.'],
      dark: ['Life is long, child. Dark days end too.'],
    },
    fr: {
      greet: ['Assieds-toi. J’en ai vu beaucoup dans ma vie.', 'Les vieilles cartes ne mentent pas, mon enfant.'],
      shuffle: ['Ne te presse pas. Les cartes aiment la patience.'],
      best: ['Oh, il y a longtemps que je n’ai pas vu pareille carte.'],
      worst: ['N’aie pas peur. Tout passe, cela passera aussi.'],
      bright: ['Un bon tirage. Souviens-t’en quand ce sera difficile.'],
      dark: ['La vie est longue, mon enfant. Les jours sombres finissent aussi.'],
    },
  },
};

/** A line for the moment: half the time one of her own, where she has one. */
export function lineFor(teller: string, line: Line, lang: Lang): string {
  const own = OWN_LINES[teller]?.[lang][line];
  const pool = own && Math.random() < 0.5 ? own : LINES[lang][line];
  return pool[(Math.random() * pool.length) | 0];
}
