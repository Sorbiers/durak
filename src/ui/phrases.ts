import { Lang } from './i18n';

// Moments at the table when a computer player may say something.
export type Remark =
  | 'greet' // the deal
  | 'lead' // opens a bout
  | 'throwIn' // adds a card to the attack
  | 'beat' // beats a card
  | 'beatTrump' // has to spend a trump on a plain card
  | 'take' // picks the cards up
  | 'done' // ends the attack: the bout is beaten
  | 'pass' // has nothing to add
  | 'transfer' // passes the attack on
  | 'gotTransfer' // the attack was passed on to them
  | 'theyTake' // their attack made the defender pick up
  | 'lastCard' // one card left and the deck is gone
  | 'deckOut' // the last card has been drawn
  | 'waiting' // the human has been thinking for a long time
  | 'out' // got rid of every card
  | 'fool' // lost
  | 'youFool'; // the human lost

/** How likely a remark is to be made when its moment comes. The rest are always made. */
export const REMARK_CHANCE: Partial<Record<Remark, number>> = {
  lead: 0.25,
  throwIn: 0.25,
  beat: 0.25,
  beatTrump: 0.5,
  gotTransfer: 0.7,
  theyTake: 0.65,
  deckOut: 0.7,
};

type Lines = Partial<Record<Remark, string[]>>;

// Lines anyone might say. Kept free of gendered verb forms, since any character may use them.
// The first line of take, done, pass and transfer is the bare announcement of the action.
const COMMON: Record<Lang, Lines> = {
  ru: {
    greet: ['Ну что, сыграем?', 'Карты на стол.', 'Посмотрим, кто кого.', 'Ну-с, приступим.'],
    lead: ['Начнём с малого.', 'Хожу.', 'Посмотрим, что у вас есть.', 'С этой и зайдём.', 'Вот вам для начала.'],
    throwIn: ['И вот ещё.', 'Подкину.', 'Это тоже вам.', 'А вот и добавка.', 'Довесок.'],
    beat: ['Бью.', 'Крою.', 'Есть чем ответить.', 'Отбито.', 'Не страшно.'],
    beatTrump: ['Придётся козырем.', 'Жалко козыря, но бью.', 'Без козыря никак.'],
    take: ['Беру.', 'Что ж, беру.', 'Заберу.', 'Придётся взять.'],
    done: ['Бито.', 'Бито, убирайте.', 'Всё, бито.'],
    pass: ['Пас.', 'Добавить нечего.'],
    transfer: ['Перевожу.', 'Это не ко мне. Перевожу.', 'Переводной так переводной. Перевожу.'],
    gotTransfer: ['Вот как…', 'Ловко.', 'Ну спасибо.', 'Вот тебе и раз.'],
    theyTake: ['Берите, берите.', 'На здоровье.', 'Пригодится.', 'Копите, копите.', 'Теперь это ваше.'],
    lastCard: ['Последняя карта.', 'Осталась одна.', 'У меня последняя.'],
    deckOut: ['Колода кончилась.', 'Добора больше нет.', 'Теперь — эндшпиль.'],
    waiting: ['Ваш ход.', 'Мы не торопим.', 'Думайте, думайте.'],
    out: ['У меня всё.', 'Карт больше нет.', 'Я — всё.'],
    fool: ['Бывает…', 'Сегодня не мой день.', 'Что ж, поздравляю.'],
    youFool: ['Реванш?', 'С кем не бывает.', 'Ещё партию?', 'Карты — дело такое.'],
  },
  en: {
    greet: ['Shall we?', 'Cards on the table.', "Let's see who gets whom.", 'Well then, let us begin.'],
    lead: ['Something small to start.', 'My lead.', "Let's see what you hold.", "We'll open with this.", 'Here, for a start.'],
    throwIn: ['And one more.', "I'll add to that.", 'This one is yours too.', 'A little extra.', 'A makeweight.'],
    beat: ['Beaten.', 'Covered.', 'I have an answer.', 'Answered.', 'No trouble.'],
    beatTrump: ['It takes a trump.', 'A shame to spend a trump, but I beat it.', 'Nothing for it but a trump.'],
    take: ['I take.', "Well, I'll take them.", "I'll pick up.", 'I have to take.'],
    done: ['Done.', 'Done, clear it away.', "That's it, done."],
    pass: ['Pass.', 'Nothing to add.'],
    transfer: ['Passing it on.', 'Not for me. Passing it on.', 'Pass-on it is. Passing it on.'],
    gotTransfer: ['Is that so…', 'Neat.', 'Thanks a lot.', 'Well, well.'],
    theyTake: ['Go on, take them.', "You're welcome.", "They'll come in handy.", 'Keep collecting.', "They're yours now."],
    lastCard: ['Last card.', 'One left.', 'I am down to one.'],
    deckOut: ['The deck is gone.', 'No more drawing.', 'Now for the endgame.'],
    waiting: ['Your move.', 'No hurry.', 'Take your time.'],
    out: ["That's all from me.", 'No cards left.', "I'm done."],
    fool: ['It happens…', 'Not my day.', 'Well, congratulations.'],
    youFool: ['A rematch?', 'Happens to everyone.', 'Another game?', "That's cards for you."],
  },
};

// What each character says in their own voice, keyed by character id.
const PERSONAL: Record<string, Record<Lang, Lines>> = {
  // Boris: the strongest. Dry and exact, always counting.
  boris: {
    ru: {
      greet: ['Играем внимательно.', 'Посмотрим, как вы считаете карты.'],
      lead: ['Первый ход — разведка.'],
      throwIn: ['Продолжим давление.'],
      beat: ['Отбито.', 'Предсказуемо.'],
      beatTrump: ['Козырь потрачен по делу.'],
      take: ['Беру. Так надо.', 'Беру. Это вложение.'],
      transfer: ['Перевод.', 'Возвращаю отправителю.'],
      gotTransfer: ['Учтено.'],
      theyTake: ['Расчёт верный.', 'Запоминаю, что вы взяли.'],
      lastCard: ['Одна карта. Вы знаете какая?'],
      deckOut: ['Колода пуста. Теперь всё считается.'],
      waiting: ['Думайте. Это полезно.'],
      out: ['Как и планировалось.', 'Партия сыграна.'],
      fool: ['Ошибка в расчёте. Учту.', 'Редкий случай. Поздравляю.'],
      youFool: ['Считайте карты.', 'Разберите партию — найдёте ошибку.'],
    },
    en: {
      greet: ['Play carefully.', "Let's see how well you count cards."],
      lead: ['The first move is reconnaissance.'],
      throwIn: ['We keep up the pressure.'],
      beat: ['Answered.', 'Predictable.'],
      beatTrump: ['A trump well spent.'],
      take: ['I take. It is the right move.', 'I take. Call it an investment.'],
      transfer: ['Passed on.', 'Return to sender.'],
      gotTransfer: ['Noted.'],
      theyTake: ['As calculated.', 'I am remembering what you took.'],
      lastCard: ['One card. Do you know which?'],
      deckOut: ['The deck is empty. Now everything can be counted.'],
      waiting: ['Think. It does you good.'],
      out: ['As planned.', 'The game is played.'],
      fool: ['An error in my count. Noted.', 'A rare event. Congratulations.'],
      youFool: ['Count the cards.', 'Go over the game. You will find the mistake.'],
    },
  },
  // Vera: warm, sharp, a little ironic.
  vera: {
    ru: {
      greet: ['Рада партии. Только не поддавайтесь.', 'Ну, удивите меня.'],
      lead: ['Начну деликатно.'],
      throwIn: ['И ещё одну, для компании.'],
      beat: ['А мы вот так.', 'Это мы умеем.'],
      beatTrump: ['Жаль козыря, но вы настояли.'],
      take: ['Беру, не жалко.', 'Возьму. У меня на них планы.'],
      transfer: ['Передаю дальше, с приветом.', 'Это, пожалуй, не мне.'],
      gotTransfer: ['Какая любезность.'],
      theyTake: ['Ой, сколько вам досталось.', 'Вам идёт полная рука.'],
      lastCard: ['У меня одна. Угадаете?'],
      deckOut: ['Колода кончилась. Самое интересное.'],
      waiting: ['Я не тороплю. Почти.'],
      out: ['Спасибо за игру, я закончила.', 'Я вас покидаю.'],
      fool: ['Ну вот, заболталась.', 'Сама виновата.'],
      youFool: ['Не расстраивайтесь, бывает.', 'Вы играли лучше, чем кажется.'],
    },
    en: {
      greet: ['Glad to play. No going easy on me.', 'Go on, surprise me.'],
      lead: ["I'll start gently."],
      throwIn: ['And one more, for company.'],
      beat: ['And we do this.', 'That, we can manage.'],
      beatTrump: ['A pity about the trump, but you insisted.'],
      take: ["I'll take them, I don't mind.", "I'll take them. I have plans for these."],
      transfer: ['On it goes, with my regards.', "I don't think this one is for me."],
      gotTransfer: ['How kind of you.'],
      theyTake: ['My, what a pile you got.', 'A full hand suits you.'],
      lastCard: ['I have one. Care to guess?'],
      deckOut: ['The deck is gone. Now it gets interesting.'],
      waiting: ["I'm not rushing you. Almost."],
      out: ["Thank you for the game, I'm finished.", 'I shall leave you to it.'],
      fool: ['There, I talked too much.', 'My own fault.'],
      youFool: ["Don't be upset, it happens.", 'You played better than it looks.'],
    },
  },
  // Gleb: jovial, a proverb for every occasion.
  gleb: {
    ru: {
      greet: ['Знал бы прикуп — жил бы в Сочи!', 'Кто не рискует — тот не пьёт шампанского!'],
      lead: ['Ход конём… то есть шестёркой.', 'Тише едешь — дальше будешь.'],
      throwIn: ['Кашу маслом не испортишь!', 'Довесочек!'],
      beat: ['Карте место!', 'На всякого мудреца довольно простоты!'],
      beatTrump: ['Без козыря — как без рук.'],
      take: ['Беру, в хозяйстве пригодится.', 'Беру. Дают — бери!'],
      transfer: ['Передай другому!', 'С больной головы — на здоровую!'],
      gotTransfer: ['Не рой другому яму…'],
      theyTake: ['Кушайте на здоровье!', 'Дают — бери, бьют — беги!'],
      lastCard: ['Последняя — она самая сладкая.'],
      deckOut: ['Колода — всё. Кончилась лафа!'],
      waiting: ['Семь раз отмерь… но ходить-то надо!'],
      out: ['А я — на свободу!', 'Сделал дело — гуляй смело!'],
      fool: ['Эх, не везёт мне в картах…', 'И на старуху бывает проруха.'],
      youFool: ['Не в картах счастье!', 'Первый блин комом!'],
    },
    en: {
      greet: ['If I knew the cards, I would live by the sea!', 'Nothing ventured, nothing gained!'],
      lead: ["A knight's move… well, a six.", 'Slow and steady wins the race.'],
      throwIn: ["You can't have too much of a good thing!", 'A little extra!'],
      beat: ['A card laid is a card played!', 'Even the wise slip up!'],
      beatTrump: ['Without a trump I am without hands.'],
      take: ["I'll take them, everything comes in useful.", 'I take. Never refuse a gift!'],
      transfer: ['Pass it along!', 'Let it be someone else’s headache!'],
      gotTransfer: ['Dig a pit for another…'],
      theyTake: ['Enjoy, with my compliments!', 'When they give, take!'],
      lastCard: ['The last one is the sweetest.'],
      deckOut: ['The deck is done. The easy days are over!'],
      waiting: ['Measure twice… but do cut eventually!'],
      out: ["And I'm a free man!", 'Work done, off I go!'],
      fool: ['Ah, no luck at cards for me…', 'Even an old hand slips.'],
      youFool: ["Cards aren't everything!", 'The first pancake is always lumpy!'],
    },
  },
  // Lev: old, sly, has seen it all.
  lev: {
    ru: {
      greet: ['Молодёжь, не торопитесь.', 'Сыграем по-стариковски.'],
      lead: ['Начнём потихоньку.'],
      throwIn: ['У меня ещё найдётся.'],
      beat: ['И не такое били.', 'Это мы проходили.'],
      beatTrump: ['Козыри надо беречь. Но не сегодня.'],
      take: ['Старику и это сгодится.', 'Беру. Спешить мне некуда.'],
      transfer: ['Это вам, голубчик.', 'Передаю по наследству.'],
      gotTransfer: ['Ишь, какой шустрый.'],
      theyTake: ['Я такое ещё в молодости проходил.', 'Берите, не стесняйтесь.'],
      lastCard: ['Одна осталась. Как зуб.'],
      deckOut: ['Вот и колода кончилась. Как жизнь.'],
      waiting: ['Думайте, думайте. Я подремлю.'],
      out: ['Опыт, знаете ли.', 'Старый конь борозды не портит.'],
      fool: ['Память уже не та…', 'Очки не те надел.'],
      youFool: ['Учитесь, пока я жив.', 'Ничего, с годами придёт.'],
    },
    en: {
      greet: ['No rush, young people.', "We'll play the old way."],
      lead: ["Let's start slowly."],
      throwIn: ['I have a little more.'],
      beat: ['I have beaten worse.', 'We covered that long ago.'],
      beatTrump: ['Trumps should be saved. Not today.'],
      take: ['An old man can use these too.', "I take. I'm in no hurry."],
      transfer: ['This is for you, my dear.', 'I leave it to you in my will.'],
      gotTransfer: ['Quick, aren’t you.'],
      theyTake: ['I saw that trick when I was young.', "Take them, don't be shy."],
      lastCard: ['One left. Like my teeth.'],
      deckOut: ['And so the deck runs out. Like life.'],
      waiting: ["Think away. I'll take a nap."],
      out: ['Experience, you know.', 'An old horse keeps the furrow straight.'],
      fool: ['The memory is not what it was…', 'I put on the wrong glasses.'],
      youFool: ["Learn while I'm still around.", 'Never mind, it comes with age.'],
    },
  },
  // Tamara: strict, like a schoolteacher.
  tamara: {
    ru: {
      greet: ['Играем честно.', 'Тишина за столом. Начинаем.'],
      lead: ['Начнём с простого задания.'],
      throwIn: ['Дополнительный вопрос.'],
      beat: ['Не пройдёт.', 'Ответ верный.'],
      beatTrump: ['Вынуждена применить козырь.'],
      take: ['Беру. Без комментариев.', 'Беру. Разберу дома.'],
      transfer: ['Это не моё.', 'Вопрос переадресован.'],
      gotTransfer: ['Не ожидала от вас.'],
      theyTake: ['Вот и правильно.', 'Садитесь, берите.'],
      lastCard: ['Осталась одна. Внимание.'],
      deckOut: ['Колода закончилась. Собрались.'],
      waiting: ['Время идёт.'],
      out: ['Урок окончен.', 'Я закончила. Остальные продолжают.'],
      fool: ['Недосмотрела.', 'Сегодня мне двойка.'],
      youFool: ['Работа над ошибками — завтра.', 'Садитесь, неуд.'],
    },
    en: {
      greet: ['We play fair.', 'Quiet at the table. We begin.'],
      lead: ["We'll start with an easy exercise."],
      throwIn: ['A follow-up question.'],
      beat: ["That won't pass.", 'Correct answer.'],
      beatTrump: ['I am obliged to use a trump.'],
      take: ['I take. No comment.', "I take. I'll look at it at home."],
      transfer: ['Not mine.', 'The question is redirected.'],
      gotTransfer: ['I did not expect that of you.'],
      theyTake: ['Quite right.', 'Sit down and take them.'],
      lastCard: ['One left. Pay attention.'],
      deckOut: ['The deck is finished. Concentrate.'],
      waiting: ['Time is passing.'],
      out: ['Class dismissed.', 'I have finished. The rest carry on.'],
      fool: ['I overlooked it.', 'A fail for me today.'],
      youFool: ['We go over the mistakes tomorrow.', 'Sit down. Fail.'],
    },
  },
  // Anton: young, serious, competitive. Says "ты" to everyone.
  anton: {
    ru: {
      greet: ['Я сегодня в форме.', 'Погнали.'],
      lead: ['Захожу.'],
      throwIn: ['Держи ещё.'],
      beat: ['Мимо.', 'Легко.'],
      beatTrump: ['Ладно, козырем.'],
      take: ['Ладно, беру.', 'Беру. Отыграюсь.'],
      transfer: ['Лови.', 'Не мой клиент.'],
      gotTransfer: ['Серьёзно?'],
      theyTake: ['Так-то.', 'Без шансов.'],
      lastCard: ['Одна карта. Финиш близко.'],
      deckOut: ['Колода всё. Теперь по-взрослому.'],
      waiting: ['Ну ходи уже.'],
      out: ['Чисто сработано.', 'Вышел. Кто следующий?'],
      fool: ['Да как так-то?!', 'Требую реванш.'],
      youFool: ['Ничего личного.', 'Тренируйся.'],
    },
    en: {
      greet: ["I'm on form today.", "Let's go."],
      lead: ['Coming in.'],
      throwIn: ['Have another.'],
      beat: ['Missed.', 'Easy.'],
      beatTrump: ['Fine, a trump.'],
      take: ['Fine, I take.', "I take. I'll win it back."],
      transfer: ['Catch.', 'Not my problem.'],
      gotTransfer: ['Seriously?'],
      theyTake: ["That's how it's done.", 'No chance.'],
      lastCard: ['One card. Nearly there.'],
      deckOut: ['Deck is out. Now it gets serious.'],
      waiting: ['Come on, play.'],
      out: ['Clean work.', "I'm out. Who's next?"],
      fool: ['How did that happen?!', 'I demand a rematch.'],
      youFool: ['Nothing personal.', 'Keep practising.'],
    },
  },
  // Fyodor: grumpy, blames the deck.
  fyodor: {
    ru: {
      greet: ['Давайте быстрее.', 'Опять карты так себе.'],
      lead: ['На, отбивай.'],
      throwIn: ['И это забери.'],
      beat: ['Ну на.', 'Допустим.'],
      beatTrump: ['Козыря жалко. Эх.'],
      take: ['Беру. Довольны?', 'Беру. Как всегда.'],
      transfer: ['Забирай своё.', 'Мне чужого не надо.'],
      gotTransfer: ['Ну конечно. Мне.'],
      theyTake: ['То-то же.', 'Вот и сиди с ними.'],
      lastCard: ['Одна. Не сглазить бы.'],
      deckOut: ['Колода кончилась. Хорошего и не было.'],
      waiting: ['Долго ещё?'],
      out: ['Наконец-то.', 'Вышел. Сам не верю.'],
      fool: ['Карта не идёт. Колода краплёная.', 'Так и знал.'],
      youFool: ['А я говорил.', 'Не всё мне одному.'],
    },
    en: {
      greet: ['Get on with it.', 'Poor cards again.'],
      lead: ['There, beat that.'],
      throwIn: ['Take this one too.'],
      beat: ['There.', 'If you say so.'],
      beatTrump: ['A waste of a trump. Ah well.'],
      take: ['I take. Happy now?', 'I take. As always.'],
      transfer: ['Have it back.', "I don't want what isn't mine."],
      gotTransfer: ['Of course. To me.'],
      theyTake: ['Serves you right.', 'Now sit there with them.'],
      lastCard: ["One. Don't jinx it."],
      deckOut: ['The deck is gone. Not that it was any good.'],
      waiting: ['Much longer?'],
      out: ['At last.', "I'm out. I can't believe it myself."],
      fool: ['No cards coming. The deck is marked.', 'I knew it.'],
      youFool: ['I told you so.', "For once it isn't me."],
    },
  },
  // Lyuba: cheerful and chatty.
  lyuba: {
    ru: {
      greet: ['Ой, как я люблю дурака!', 'Чур, я не дурак!'],
      lead: ['Вот вам, с любовью!'],
      throwIn: ['И ещё гостинчик!'],
      beat: ['А у меня вот что есть!', 'Оп — и нету!'],
      beatTrump: ['Козырька не пожалею!'],
      take: ['Возьму, чего добру пропадать.', 'Беру-беру, всё в дом!'],
      transfer: ['А это — соседу!', 'Ой, это не мне!'],
      gotTransfer: ['Ах вы хитрец!'],
      theyTake: ['Ничего, отыграетесь!', 'Ой, как много! Сочувствую!'],
      lastCard: ['Одна-одинёшенька осталась!'],
      deckOut: ['Ой, колода кончилась! Как быстро!'],
      waiting: ['Вы там не уснули?'],
      out: ['А я всё, я свободна!', 'Ура, вышла!'],
      fool: ['Зато в любви повезёт!', 'Ну и ладно, зато весело!'],
      youFool: ['Вам в любви повезёт!', 'Не грустите, давайте ещё!'],
    },
    en: {
      greet: ['Oh, I do love a game of Durak!', "Dibs on not being the fool!"],
      lead: ['Here you are, with love!'],
      throwIn: ['And another little treat!'],
      beat: ['Look what I have!', "Hop, and it's gone!"],
      beatTrump: ["I won't grudge a little trump!"],
      take: ["I'll take them, no sense wasting good cards.", 'I take, I take, everything comes home with me!'],
      transfer: ['And this goes to my neighbour!', "Oh, that's not for me!"],
      gotTransfer: ['Oh, you sly thing!'],
      theyTake: ["Never mind, you'll win it back!", 'Oh, so many! You poor thing!'],
      lastCard: ['One lonely little card left!'],
      deckOut: ['Oh, the deck is gone! So soon!'],
      waiting: ['Have you nodded off over there?'],
      out: ["And I'm done, I'm free!", "Hooray, I'm out!"],
      fool: ['Lucky in love, at least!', 'Oh well, it was fun!'],
      youFool: ["You'll be lucky in love!", "Don't be sad, let's play again!"],
    },
  },
  // Kostya: a cheerful beginner, surprised when things work.
  kostya: {
    ru: {
      greet: ['О, привет! А кто сдаёт?', 'А козырь — это который сильнее, да?'],
      lead: ['Так, хожу… вот этой!'],
      throwIn: ['А можно ещё? Можно!'],
      beat: ['Опа!', 'Получилось!'],
      beatTrump: ['Козырем можно? Тогда козырем!'],
      take: ['Ой, беру-беру.', 'Беру… а что, так много?'],
      transfer: ['Держи подарочек!', 'Переводить же можно? Перевожу!'],
      gotTransfer: ['Эй, так нечестно!'],
      theyTake: ['Вау, получилось!', 'Я сам в шоке!'],
      lastCard: ['У меня одна! Это хорошо?'],
      deckOut: ['А карты где? Всё, что ли?'],
      waiting: ['А долго думать — это по правилам?'],
      out: ['Я что, вышел? Серьёзно?!', 'Я выиграл? Маме расскажу!'],
      fool: ['Опять я… ну и ладно!', 'Зато я старался!'],
      youFool: ['Ого, я не дурак!', 'Погоди, я что, победил?!'],
    },
    en: {
      greet: ['Oh, hi! Whose deal is it?', 'The trump is the stronger one, right?'],
      lead: ['Right, I play… this one!'],
      throwIn: ['Can I add more? I can!'],
      beat: ['Whoa!', 'It worked!'],
      beatTrump: ['Is a trump allowed? A trump, then!'],
      take: ['Oops, I take, I take.', 'I take… wait, that many?'],
      transfer: ['Here, a little present!', "You can pass it on, right? I'm passing it on!"],
      gotTransfer: ["Hey, that's not fair!"],
      theyTake: ['Wow, it worked!', "I'm as surprised as you!"],
      lastCard: ['I have one! Is that good?'],
      deckOut: ['Where are the cards? Is that all?'],
      waiting: ['Is thinking this long in the rules?'],
      out: ['Am I out? Seriously?!', "Did I win? I'm telling my mum!"],
      fool: ['Me again… oh well!', 'At least I tried!'],
      youFool: ["Whoa, I'm not the fool!", 'Hang on, did I win?!'],
    },
  },
};

const lastSaid = new Map<string, string>();

/**
 * A line for this character at this moment. Their own lines are preferred when they have
 * some, and the same line is not said twice running.
 */
export function remark(characterId: string, what: Remark, lang: Lang): string {
  const own = PERSONAL[characterId]?.[lang][what] ?? [];
  const shared = COMMON[lang][what] ?? [];
  const pool = own.length > 0 && (shared.length === 0 || Math.random() < 0.6) ? own : shared;
  const previous = lastSaid.get(characterId);
  const fresh = pool.filter((line) => line !== previous);
  const choices = fresh.length > 0 ? fresh : pool.length > 0 ? pool : shared;
  const line = choices[(Math.random() * choices.length) | 0] ?? '';
  lastSaid.set(characterId, line);
  return line;
}

/** Every line a character can say in a language, their own and the shared ones. */
export function linesFor(characterId: string, lang: Lang): string[] {
  const all = [PERSONAL[characterId]?.[lang] ?? {}, COMMON[lang]].flatMap((lines) =>
    Object.values(lines).flat(),
  );
  return [...new Set(all)];
}

/**
 * The file name of the recorded clip for a line: a short hash of its text, so the generator
 * and the game agree on it without a lookup table, and an edited line gets a new clip.
 */
export function clipName(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The bare announcement of an action, used when chatter is switched off. */
export function plainRemark(what: Remark, lang: Lang): string {
  return COMMON[lang][what]?.[0] ?? '';
}
