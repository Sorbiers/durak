import { Card, RANKS, makeCard } from '../engine/cards';
import { Lang } from '../ui/i18n';

// What the cards mean, in the two systems read here. Both use the same 36 cards, six to ace.
// The wording is our own: the folk meanings of the Russian tradition, and the usual keywords of
// the Lenormand oracle, whose cards each carry one of these playing cards as an inset.

/** Whether a card bodes well (1), ill (-1) or neither (0). */
export type Tone = -1 | 0 | 1;

export interface Meaning {
  tone: Tone;
  strong?: boolean; // one of the cards that weigh most, for good or ill
  text: Record<Lang, [keyword: string, sentence: string]>;
}

/** A Lenormand card: its number and emblem, and the playing card it is printed on. */
export interface Emblem extends Meaning {
  n: number;
  card: Card;
  name: Record<Lang, string>;
}

const SPADES = 0;
const HEARTS = 1;
const DIAMONDS = 2;
const CLUBS = 3;
const RANK = { '6': 0, '7': 1, '8': 2, '9': 3, '10': 4, J: 5, Q: 6, K: 7, A: 8 } as const;
const card = (rank: keyof typeof RANK, suit: number): Card => makeCard(suit, RANK[rank]);

type Row = [Tone, ru: [string, string], en: [string, string], fr: [string, string], strong?: boolean];

// The Russian tradition, one suit at a time, from the six up to the ace.
const BY_SUIT: Record<number, Row[]> = {
  [SPADES]: [
    [0, ['Дальняя дорога', 'Долгая или нелёгкая дорога, поездка по необходимости.'], ['A long road', 'A long or tiring journey, one made out of necessity.'], ['Une longue route', 'Un voyage long ou pénible, fait par nécessité.']],
    [-1, ['Огорчение', 'Размолвка, слёзы, мелкая обида.'], ['Upset', 'A falling-out, tears, a small hurt.'], ['Un chagrin', 'Une brouille, des larmes, une petite blessure.']],
    [-1, ['Тяжёлый разговор', 'Неприятная беседа, упрёки, выяснение отношений.'], ['A hard talk', 'An unpleasant conversation, reproaches, having it out.'], ['Une conversation pénible', 'Des reproches, une explication qui fâche.']],
    [-1, ['Недомогание', 'Усталость, болезнь или полоса неудач: поберегите себя.'], ['Ill health', 'Weariness, illness or a run of bad luck: take care of yourself.'], ['La fatigue', 'Lassitude, maladie ou série de malchances : ménagez-vous.']],
    [-1, ['Разочарование', 'Неудача; планы, которым не суждено сбыться.'], ['Disappointment', 'A setback; plans that will not come to anything.'], ['La déception', 'Un échec ; des projets qui n’aboutiront pas.']],
    [-1, ['Пустые хлопоты', 'Суета без толку, дурные вести, мелкий обманщик.'], ['Wasted effort', 'Fuss that comes to nothing, bad news, a petty cheat.'], ['Peine perdue', 'De l’agitation pour rien, de mauvaises nouvelles, un petit tricheur.']],
    [-1, ['Соперница', 'Недоброжелательница или соперница; строгая, властная женщина.'], ['A rival', 'A woman who wishes you ill, or a rival; a stern, commanding woman.'], ['Une rivale', 'Une femme malveillante ou une rivale ; une femme sévère et autoritaire.']],
    [0, ['Власть', 'Влиятельный и суровый мужчина: начальник, чиновник, соперник.'], ['Authority', 'A powerful, stern man: a superior, an official, a rival.'], ['L’autorité', 'Un homme influent et sévère : un supérieur, un fonctionnaire, un rival.']],
    [-1, ['Удар', 'Серьёзная неприятность, потрясение; казённый дом.'], ['A blow', 'Serious trouble, a shock; dealings with officialdom.'], ['Un coup dur', 'Un gros ennui, un choc ; une affaire avec l’administration.'], true],
  ],
  [HEARTS]: [
    [1, ['Дорога к милому', 'Приятная поездка, дорога к дорогому человеку.'], ['A happy journey', 'A pleasant trip, a road to someone dear.'], ['Un voyage heureux', 'Un trajet agréable, la route vers un être cher.']],
    [1, ['Свидание', 'Встреча с тем, кто дорог сердцу.'], ['A date', 'A meeting with someone close to your heart.'], ['Un rendez-vous', 'Une rencontre avec quelqu’un qui vous est cher.']],
    [1, ['Душевный разговор', 'Тёплая беседа, признание, добрые слова.'], ['A heart-to-heart', 'A warm talk, a confession, kind words.'], ['Une conversation intime', 'Des mots chaleureux, un aveu, de la tendresse.']],
    [1, ['Любовь', 'Взаимное чувство: лучшая карта для сердечных дел.'], ['Love', 'Love returned: the best card for matters of the heart.'], ['L’amour', 'Un amour partagé : la meilleure carte pour les affaires de cœur.'], true],
    [1, ['Радость', 'Исполнение желаний, праздник, счастливый случай.'], ['Joy', 'A wish come true, a celebration, a happy chance.'], ['La joie', 'Un vœu exaucé, une fête, un heureux hasard.']],
    [1, ['Сердечные мысли', 'Мысли о любимом, приятные заботы, молодой поклонник.'], ['Thoughts of love', 'Thinking of someone dear, pleasant cares, a young admirer.'], ['Pensées tendres', 'On pense à l’être aimé ; de doux soucis, un jeune admirateur.']],
    [1, ['Любящая женщина', 'Добрая, любящая женщина; верная подруга.'], ['A loving woman', 'A kind and loving woman; a faithful friend.'], ['Une femme aimante', 'Une femme bonne et aimante ; une amie fidèle.']],
    [1, ['Любимый', 'Любящий мужчина: возлюбленный, муж, добрый друг.'], ['A beloved man', 'A loving man: a sweetheart, a husband, a good friend.'], ['L’homme aimé', 'Un homme aimant : un amoureux, un mari, un bon ami.']],
    [1, ['Дом', 'Родной дом, семья, уют; любовное письмо.'], ['Home', 'Home and family, comfort; a love letter.'], ['Le foyer', 'La maison, la famille, le confort ; une lettre d’amour.']],
  ],
  [DIAMONDS]: [
    [0, ['Скорая дорога', 'Короткая поездка, хлопоты в пути.'], ['A short trip', 'A brief journey, some bustle on the way.'], ['Un court trajet', 'Un petit déplacement, un peu d’agitation en route.']],
    [1, ['Подарок', 'Небольшие деньги, подарок, приятный сюрприз.'], ['A gift', 'A little money, a present, a pleasant surprise.'], ['Un cadeau', 'Un peu d’argent, un présent, une agréable surprise.']],
    [0, ['Деловой разговор', 'Разговор о деньгах, выгодное предложение.'], ['A business talk', 'Talk about money, a good offer.'], ['Une discussion d’affaires', 'On parle d’argent ; une offre intéressante.']],
    [1, ['Интерес', 'Симпатия, новое увлечение; к вам приглядываются.'], ['Interest', 'A liking, a new attraction; someone has an eye on you.'], ['L’intérêt', 'Une sympathie, une nouvelle attirance ; quelqu’un vous remarque.']],
    [1, ['Деньги', 'Прибыль, удачная сделка, денежная удача.'], ['Money', 'Profit, a good deal, luck with money.'], ['L’argent', 'Un profit, une bonne affaire, de la chance avec l’argent.']],
    [0, ['Хлопоты', 'Суета, ожидание вестей, мелкие заботы.'], ['Bustle', 'Busy days, waiting for news, small cares.'], ['Les tracas', 'De l’agitation, l’attente de nouvelles, de petits soucis.']],
    [0, ['Молодая девушка', 'Молодая незамужняя женщина, подруга.'], ['A young woman', 'A young unmarried woman, a girlfriend.'], ['Une jeune femme', 'Une jeune femme célibataire, une amie.']],
    [0, ['Молодой человек', 'Молодой неженатый мужчина, жених.'], ['A young man', 'A young unmarried man, a suitor.'], ['Un jeune homme', 'Un jeune homme célibataire, un prétendant.']],
    [1, ['Весть', 'Письмо, важная новость, бумаги.'], ['News', 'A letter, important news, papers.'], ['Une nouvelle', 'Une lettre, une nouvelle importante, des papiers.']],
  ],
  [CLUBS]: [
    [0, ['Деловая поездка', 'Поездка по работе, командировка.'], ['A business trip', 'A journey for work.'], ['Un voyage d’affaires', 'Un déplacement pour le travail.']],
    [0, ['Встреча по делу', 'Переговоры, договорённость, деловое свидание.'], ['A business meeting', 'Negotiations, an agreement, a meeting about work.'], ['Un rendez-vous d’affaires', 'Des négociations, un accord, une rencontre de travail.']],
    [-1, ['Пересуды', 'Разговоры за спиной, сплетни на работе.'], ['Gossip', 'Talk behind your back, gossip at work.'], ['Les ragots', 'On parle derrière votre dos ; des commérages au travail.']],
    [1, ['Дружба', 'Верность, согласие, надёжное чувство.'], ['Friendship', 'Loyalty, harmony, a feeling you can rely on.'], ['L’amitié', 'La fidélité, l’entente, un sentiment solide.']],
    [1, ['Удача в делах', 'Успех на работе, хороший доход.'], ['Success at work', 'Things go well at work; a good income.'], ['Le succès', 'Réussite au travail, bons revenus.']],
    [-1, ['Заботы о деньгах', 'Хлопоты на работе, нехватка денег.'], ['Money worries', 'Trouble at work, money running short.'], ['Soucis d’argent', 'Des tracas au travail, l’argent qui manque.']],
    [0, ['Союзница', 'Зрелая замужняя женщина, коллега; надёжная союзница.'], ['An ally', 'A mature married woman, a colleague; a reliable ally.'], ['Une alliée', 'Une femme mariée d’âge mûr, une collègue ; une alliée sûre.']],
    [1, ['Покровитель', 'Женатый надёжный мужчина; покровитель, начальник.'], ['A patron', 'A dependable married man; a patron, a superior.'], ['Un protecteur', 'Un homme marié et fiable ; un protecteur, un supérieur.']],
    [0, ['Служба', 'Работа, учреждение, важное дело.'], ['Work', 'Your job, an institution, an important matter.'], ['Le travail', 'L’emploi, une institution, une affaire importante.']],
  ],
};

const meaning = ([tone, ru, en, fr, strong]: Row): Meaning => ({ tone, strong, text: { ru, en, fr } });

/** The Russian tradition's meaning of each card, indexed by card. */
export const RUSSIAN: Meaning[] = [SPADES, HEARTS, DIAMONDS, CLUBS].flatMap((suit) => {
  const rows = BY_SUIT[suit];
  if (rows.length !== RANKS) throw new Error(`suit ${suit} has ${rows.length} meanings`);
  return rows.map(meaning);
});

type EmblemRow = [
  n: number,
  card: Card,
  tone: Tone,
  name: [ru: string, en: string, fr: string],
  ru: [string, string],
  en: [string, string],
  fr: [string, string],
  strong?: boolean,
];

// The 36 Lenormand cards in their order, each with the playing card printed on it.
const EMBLEM_ROWS: EmblemRow[] = [
  [1, card('9', HEARTS), 1, ['Всадник', 'Rider', 'Le Cavalier'], ['Новости', 'Скорые вести, гость; всё приходит в движение.'], ['News', 'Quick news, a visitor; things start to move.'], ['Les nouvelles', 'Des nouvelles rapides, une visite ; les choses bougent.']],
  [2, card('6', DIAMONDS), 1, ['Клевер', 'Clover', 'Le Trèfle'], ['Удача', 'Маленькая удача, счастливый шанс, но ненадолго.'], ['Luck', 'A small piece of luck, a happy chance, but a brief one.'], ['La chance', 'Un petit bonheur, une occasion heureuse, mais passagère.']],
  [3, card('10', SPADES), 0, ['Корабль', 'Ship', 'Le Navire'], ['Путь', 'Путешествие, дальние края, торговля; перемены на горизонте.'], ['Voyage', 'Travel, faraway places, trade; change on the horizon.'], ['Le voyage', 'Un voyage, des contrées lointaines, le commerce ; du changement à l’horizon.']],
  [4, card('K', HEARTS), 1, ['Дом', 'House', 'La Maison'], ['Дом', 'Семья, надёжность, всё, что вам привычно и дорого.'], ['Home', 'Family, security, all that is familiar and dear.'], ['Le foyer', 'La famille, la sécurité, tout ce qui vous est familier et cher.']],
  [5, card('7', HEARTS), 0, ['Дерево', 'Tree', 'L’Arbre'], ['Здоровье', 'Здоровье, корни, медленный и верный рост.'], ['Health', 'Health, roots, slow and steady growth.'], ['La santé', 'La santé, les racines, une croissance lente et sûre.']],
  [6, card('K', CLUBS), -1, ['Тучи', 'Clouds', 'Les Nuages'], ['Сомнения', 'Неясность, тревога, временные трудности.'], ['Doubt', 'Confusion, unease, a passing difficulty.'], ['Le doute', 'La confusion, l’inquiétude, une difficulté passagère.']],
  [7, card('Q', CLUBS), -1, ['Змея', 'Snake', 'Le Serpent'], ['Хитрость', 'Окольный путь, соблазн, хитрая соперница.'], ['Cunning', 'A roundabout way, temptation, a cunning rival.'], ['La ruse', 'Un détour, la tentation, une rivale rusée.']],
  [8, card('9', DIAMONDS), -1, ['Гроб', 'Coffin', 'Le Cercueil'], ['Конец', 'Завершение, потеря, болезнь: что-то уходит, чтобы освободить место.'], ['An ending', 'Closure, loss, illness: something goes to make room.'], ['La fin', 'Une fin, une perte, une maladie : quelque chose s’en va pour laisser la place.'], true],
  [9, card('Q', SPADES), 1, ['Букет', 'Bouquet', 'Le Bouquet'], ['Подарок', 'Радость, приглашение, комплимент, приятный сюрприз.'], ['A gift', 'Joy, an invitation, a compliment, a pleasant surprise.'], ['Le cadeau', 'De la joie, une invitation, un compliment, une agréable surprise.']],
  [10, card('J', DIAMONDS), -1, ['Коса', 'Scythe', 'La Faux'], ['Внезапность', 'Резкий поворот, быстрое решение, опасность.'], ['Suddenness', 'A sharp turn, a quick decision, danger.'], ['La soudaineté', 'Un brusque tournant, une décision rapide, un danger.']],
  [11, card('J', CLUBS), -1, ['Метла', 'Whip', 'Le Fouet'], ['Споры', 'Ссоры, напряжение, одно и то же по кругу.'], ['Strife', 'Quarrels, tension, the same thing over and over.'], ['Les disputes', 'Des querelles, des tensions, toujours la même chose.']],
  [12, card('7', DIAMONDS), 0, ['Птицы', 'Birds', 'Les Oiseaux'], ['Разговоры', 'Беседы, волнение, суета, звонки.'], ['Chatter', 'Conversations, nerves, bustle, calls.'], ['Les bavardages', 'Des conversations, de la nervosité, de l’agitation, des appels.']],
  [13, card('J', SPADES), 1, ['Ребёнок', 'Child', 'L’Enfant'], ['Начало', 'Что-то новое и маленькое; ребёнок, доверчивость.'], ['A beginning', 'Something new and small; a child, trust.'], ['Le commencement', 'Quelque chose de neuf et de petit ; un enfant, la confiance.']],
  [14, card('9', CLUBS), -1, ['Лиса', 'Fox', 'Le Renard'], ['Осторожность', 'Расчёт, ловкость, подвох: не верьте на слово.'], ['Caution', 'Calculation, slyness, a catch: do not take it on trust.'], ['La méfiance', 'Le calcul, la ruse, un piège : ne vous fiez pas aux apparences.']],
  [15, card('10', CLUBS), 0, ['Медведь', 'Bear', 'L’Ours'], ['Сила', 'Власть, покровитель, деньги, крепкая хватка.'], ['Strength', 'Power, a protector, money, a firm grip.'], ['La force', 'Le pouvoir, un protecteur, l’argent, une poigne solide.']],
  [16, card('6', HEARTS), 1, ['Звёзды', 'Stars', 'Les Étoiles'], ['Надежда', 'Ясность, вдохновение, путеводная звезда.'], ['Hope', 'Clarity, inspiration, a guiding star.'], ['L’espoir', 'La clarté, l’inspiration, une bonne étoile.']],
  [17, card('Q', HEARTS), 1, ['Аист', 'Stork', 'La Cigogne'], ['Перемены', 'Обновление, переезд, перемены к лучшему.'], ['Change', 'Renewal, a move, change for the better.'], ['Le changement', 'Un renouveau, un déménagement, un changement en mieux.']],
  [18, card('10', HEARTS), 1, ['Собака', 'Dog', 'Le Chien'], ['Друг', 'Верный друг, преданность, поддержка.'], ['A friend', 'A faithful friend, loyalty, support.'], ['L’ami', 'Un ami fidèle, la loyauté, le soutien.']],
  [19, card('6', SPADES), 0, ['Башня', 'Tower', 'La Tour'], ['Учреждение', 'Власть, закон, одиночество, взгляд свысока.'], ['Institution', 'Authority, the law, solitude, a view from above.'], ['L’institution', 'L’autorité, la loi, la solitude, une vue d’en haut.']],
  [20, card('8', SPADES), 0, ['Сад', 'Garden', 'Le Jardin'], ['Люди', 'Общество, встречи, праздник, публичность.'], ['Company', 'Society, gatherings, a party, being seen.'], ['Le monde', 'La société, les réunions, une fête, le regard des autres.']],
  [21, card('8', CLUBS), -1, ['Гора', 'Mountain', 'La Montagne'], ['Преграда', 'Препятствие, задержка, упрямство.'], ['An obstacle', 'An obstacle, a delay, stubbornness.'], ['L’obstacle', 'Un obstacle, un retard, l’entêtement.']],
  [22, card('Q', DIAMONDS), 0, ['Развилка', 'Crossroads', 'Les Chemins'], ['Выбор', 'Развилка, несколько путей: решать вам.'], ['A choice', 'A fork in the road, several ways: the choice is yours.'], ['Le choix', 'Une bifurcation, plusieurs chemins : à vous de choisir.']],
  [23, card('7', CLUBS), -1, ['Мыши', 'Mice', 'Les Souris'], ['Потери', 'Убыль, тревоги, то, что тихо подтачивает.'], ['Loss', 'Dwindling, worries, something quietly eating away.'], ['La perte', 'L’usure, les soucis, ce qui ronge en silence.']],
  [24, card('J', HEARTS), 1, ['Сердце', 'Heart', 'Le Cœur'], ['Любовь', 'Чувства, нежность, всё, что от сердца.'], ['Love', 'Feelings, tenderness, all that comes from the heart.'], ['L’amour', 'Les sentiments, la tendresse, tout ce qui vient du cœur.'], true],
  [25, card('A', CLUBS), 1, ['Кольцо', 'Ring', 'La Bague'], ['Союз', 'Обещание, договор, брак, прочная связь.'], ['Union', 'A promise, a contract, marriage, a lasting bond.'], ['L’union', 'Une promesse, un contrat, le mariage, un lien durable.']],
  [26, card('10', DIAMONDS), 0, ['Книга', 'Book', 'Le Livre'], ['Тайна', 'Секрет, знание, учёба; то, что пока скрыто.'], ['A secret', 'A secret, knowledge, study; what is hidden for now.'], ['Le secret', 'Un secret, le savoir, les études ; ce qui reste caché.']],
  [27, card('7', SPADES), 0, ['Письмо', 'Letter', 'La Lettre'], ['Письмо', 'Весточка, документ, сообщение.'], ['A letter', 'A message, a document, word from someone.'], ['La lettre', 'Un message, un document, des nouvelles de quelqu’un.']],
  [28, card('A', HEARTS), 0, ['Мужчина', 'Gentleman', 'L’Homme'], ['Мужчина', 'Тот, кто спрашивает, если это мужчина, или мужчина в жизни женщины.'], ['The man', 'The one asking, if a man, or the man in a woman’s life.'], ['L’homme', 'Le consultant, si c’est un homme, ou l’homme dans la vie d’une femme.']],
  [29, card('A', SPADES), 0, ['Женщина', 'Lady', 'La Femme'], ['Женщина', 'Та, кто спрашивает, если это женщина, или женщина в жизни мужчины.'], ['The woman', 'The one asking, if a woman, or the woman in a man’s life.'], ['La femme', 'La consultante, si c’est une femme, ou la femme dans la vie d’un homme.']],
  [30, card('K', SPADES), 1, ['Лилии', 'Lilies', 'Les Lys'], ['Покой', 'Зрелость, гармония, мир в семье.'], ['Peace', 'Maturity, harmony, peace at home.'], ['La paix', 'La maturité, l’harmonie, la paix au foyer.']],
  [31, card('A', DIAMONDS), 1, ['Солнце', 'Sun', 'Le Soleil'], ['Успех', 'Удача, сила, тепло: лучшая карта колоды.'], ['Success', 'Luck, energy, warmth: the best card in the deck.'], ['Le succès', 'La chance, l’énergie, la chaleur : la meilleure carte du jeu.'], true],
  [32, card('8', HEARTS), 1, ['Луна', 'Moon', 'La Lune'], ['Признание', 'Чувства, интуиция, слава, творчество.'], ['Recognition', 'Feelings, intuition, renown, creativity.'], ['La reconnaissance', 'Les émotions, l’intuition, la renommée, la création.']],
  [33, card('8', DIAMONDS), 1, ['Ключ', 'Key', 'La Clé'], ['Решение', 'Ответ найден, дверь открыта; это наверняка.'], ['The answer', 'The answer is found, the door is open; it is certain.'], ['La solution', 'La réponse est trouvée, la porte s’ouvre ; c’est certain.']],
  [34, card('K', DIAMONDS), 1, ['Рыбы', 'Fish', 'Les Poissons'], ['Деньги', 'Доход, дело, изобилие.'], ['Money', 'Income, business, plenty.'], ['L’argent', 'Les revenus, les affaires, l’abondance.']],
  [35, card('9', SPADES), 1, ['Якорь', 'Anchor', 'L’Ancre'], ['Опора', 'Стабильность, работа, надёжная гавань.'], ['Stability', 'Steadiness, work, a safe harbour.'], ['La stabilité', 'La constance, le travail, un port sûr.']],
  [36, card('6', CLUBS), -1, ['Крест', 'Cross', 'La Croix'], ['Испытание', 'Груз, долг, судьба: то, что надо пронести.'], ['A trial', 'A burden, duty, fate: something to be carried.'], ['L’épreuve', 'Un fardeau, un devoir, le destin : ce qu’il faut porter.'], true],
];

/** The Lenormand cards in their order, 1 to 36. */
export const EMBLEMS: Emblem[] = EMBLEM_ROWS.map(([n, c, tone, [nameRu, nameEn, nameFr], ru, en, fr, strong]) => ({
  n,
  card: c,
  tone,
  strong,
  name: { ru: nameRu, en: nameEn, fr: nameFr },
  text: { ru, en, fr },
}));

/** The Lenormand card printed on each playing card, indexed by card. */
export const LENORMAND: Emblem[] = [];
for (const e of EMBLEMS) LENORMAND[e.card] = e;

/** A line for the suit that leads a spread, in suit order: spades, hearts, diamonds, clubs. */
export const SUIT_LEADS: Record<Lang, string[]> = {
  ru: [
    'Больше всего пик: впереди трудности, но предупреждён, значит вооружён.',
    'Больше всего червей: время чувств, любви и тепла.',
    'Больше всего бубен: деньги, новости и перемены в делах.',
    'Больше всего треф: работа, дружба и устойчивость.',
  ],
  en: [
    'Spades lead: difficulties ahead, but forewarned is forearmed.',
    'Hearts lead: a time of feelings, love and warmth.',
    'Diamonds lead: money, news and changes in your affairs.',
    'Clubs lead: work, friendship and steadiness.',
  ],
  fr: [
    'Les piques dominent : des difficultés s’annoncent, mais un homme averti en vaut deux.',
    'Les cœurs dominent : un temps de sentiments, d’amour et de chaleur.',
    'Les carreaux dominent : argent, nouvelles et changements dans vos affaires.',
    'Les trèfles dominent : travail, amitié et stabilité.',
  ],
};

/** What the suit of the one card in the wish spread says, in suit order. */
export const WISH_ANSWERS: Record<Lang, string[]> = {
  ru: [
    'Пики: на пути к желанию есть препятствия.',
    'Черви: желание сбудется.',
    'Бубны: сбудется, но придётся постараться.',
    'Трефы: подумайте, так ли вам это нужно.',
  ],
  en: [
    'Spades: there are obstacles in the way of your wish.',
    'Hearts: your wish will come true.',
    'Diamonds: it will come true, but you will have to work for it.',
    'Clubs: ask yourself whether you really need it.',
  ],
  fr: [
    'Pique : des obstacles se dressent devant votre vœu.',
    'Cœur : votre vœu se réalisera.',
    'Carreau : il se réalisera, mais il faudra vous donner du mal.',
    'Trèfle : demandez-vous si vous en avez vraiment besoin.',
  ],
};
