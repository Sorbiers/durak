// What the site says about itself: page titles and descriptions for search engines, the front
// page's texts and the game's "About" text. All of it is written into the pages when the site
// is built, so that it can be read without running any script; the pages' scripts use the
// same texts when the language is switched.

export const SITE = 'https://synarteum.com/';
/** The game's folder on the site. */
export const GAME = `${SITE}durak/`;
export const REPO = 'https://github.com/Sorbiers/durak';

export type PageLang = 'ru' | 'en';

export interface PageText {
  title: string;
  description: string;
  about: string; // HTML
}

export const PAGES: Record<PageLang, PageText> = {
  ru: {
    title: 'Дурак онлайн — подкидной и переводной против сильного компьютера',
    description:
      'Дурак онлайн бесплатно и без регистрации: подкидной и переводной, 2–4 игрока, 36 карт. ' +
      'Сильный честный компьютер: он не видит ваши карты и не знает порядок колоды.',
    about: `
<h2>Дурак онлайн</h2>
<p>«Дурак» — самая известная русская карточная игра. В ней нет победителя: проигрывает тот, кто
последним остался с картами на руках, — он и есть дурак. Игроки по очереди ходят друг под друга;
отбивающийся должен побить каждую карту старшей картой той же масти или козырем, а если не может
или не хочет — забирает всё со стола.</p>
<p>Здесь можно играть бесплатно, прямо в браузере, без регистрации и рекламы: один на один или
за столом на троих и четверых против компьютерных соперников.</p>

<h3>Честный и сильный соперник</h3>
<p>Компьютер не подглядывает: он не знает порядок колоды и не видит чужих карт. Сильные игроки
делают то же, что внимательный человек: считают вышедшие карты, помнят, кто что взял, и
просчитывают ходы вперёд. Когда в игре один на один кончается колода, концовка рассчитывается
точно.</p>

<h3>Что есть в игре</h3>
<ul>
<li>Подкидной и переводной дурак, колода 36 карт, от двух до четырёх игроков.</li>
<li>Девять соперников с характером и пять уровней силы, от новичка до мастера; уровень каждого
можно задать отдельно.</li>
<li>Портреты, реплики и озвучка — по желанию.</li>
<li>Подсказка хода, просмотр «бито», счёт побед и поражений.</li>
<li>Русский и английский язык.</li>
</ul>

<h3>Правила</h3>
<ul>
<li>Каждому сдают по шесть карт; нижняя карта колоды показывает козырь.</li>
<li>В первой игре ходит тот, у кого младший козырь, и показывает его. Дальше — как выбрано в
настройках: ходит победитель прошлой игры либо ходят «под дурака».</li>
<li>Ходить можно одной картой или несколькими одного достоинства. Подкидывать может каждый,
кроме отбивающегося: карты тех достоинств, что уже лежат на столе.</li>
<li>В одном заходе не больше шести карт (до первого отбоя — пяти, это настраивается) и не
больше, чем карт у отбивающегося.</li>
<li>Тому, кто берёт, можно добавить ещё подходящих карт.</li>
<li>В переводном, пока ничего не побито, можно положить карту того же достоинства и перевести
заход на следующего игрока.</li>
<li>После захода карты добирают до шести: сначала ходившие, начиная с первого, отбивавшийся —
последним.</li>
<li>Кто остался с картами последним — дурак. Если последний заход отбит последней картой,
дурака нет: ничья.</li>
</ul>

<p class="fine">Игра — один из залов <a href="${SITE}ru/">SynArteum</a>, музея синтетического
искусства. Исходный код открыт, лицензия MIT:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  en: {
    title: 'Durak online — play the Russian card game against a strong computer',
    description:
      'Play Durak, the classic Russian card game, free in your browser. 2–4 players, 36 cards, ' +
      'throw-in and passing variants. A strong, fair computer that never sees your hand or the deck.',
    about: `
<h2>Durak online</h2>
<p>Durak (“the fool”) is the best-known Russian card game. Nobody wins it: the one player left
holding cards at the end loses and is the fool. Players take turns to attack the player on
their left; the defender must beat every card with a higher card of the same suit or with a
trump, and a defender who cannot or will not picks up everything on the table.</p>
<p>Here you can play it free in the browser, with no sign-up and no ads: one on one, or at a
table of three or four against computer opponents.</p>

<h3>A fair and strong opponent</h3>
<p>The computer does not peek: it never knows the order of the deck or anyone else's cards. The
strong players do what a careful person does: they count the cards that have gone, remember
who picked up what, and look ahead. Once the deck runs out in a two-player game, the ending is
calculated exactly.</p>

<h3>What is in the game</h3>
<ul>
<li>Podkidnoy (throw-in) and perevodnoy (passing) Durak, a 36-card deck, two to four players.</li>
<li>Nine opponents with characters of their own and five levels of strength, from beginner to
master; each one's level can be set separately.</li>
<li>Portraits, table talk and Russian voice lines, all optional.</li>
<li>A hint for the move, a view of the discard pile, a tally of wins and losses.</li>
<li>Russian and English.</li>
</ul>

<h3>Rules</h3>
<ul>
<li>Six cards each; the bottom card of the deck shows the trump suit.</li>
<li>In the first game the holder of the lowest trump leads and shows that card. After that it
goes as chosen in Settings: the winner of the previous game leads, or the lead goes at the
fool.</li>
<li>A lead is one card, or several of the same rank. Everyone except the defender may throw in
cards of any rank already on the table.</li>
<li>No more than six cards in one attack (five until the first attack has been beaten; this is
optional), and never more than the defender holds.</li>
<li>A defender who is picking up may be given more matching cards.</li>
<li>In the passing game, before beating anything, the defender may add a card of the same rank
and pass the attack on to the next player.</li>
<li>After an attack everyone draws back up to six: the attackers first, starting with whoever
led, and the defender last.</li>
<li>The last player holding cards is the fool. If the last attack is beaten with the
defender's last card, there is no fool: it is a draw.</li>
</ul>

<p class="fine">The game is one of the halls of <a href="${SITE}en/">SynArteum</a>, a museum of
synthetic art. The source is open under the MIT licence:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
};

/** Where the front page's halls lead. The first is the game, on this site. */
export const DREAM = 'https://wishmedream.com/';
export const COFFEE = 'https://wishmecoffee.com/';

/**
 * The front page: SynArteum, a SYNthetic ART musEUM with three halls. The keys are the names
 * of the slots in the page; `title` and `description` go into its head.
 */
export const LANDING: Record<PageLang, Record<string, string>> = {
  ru: {
    title: 'SynArteum — музей синтетического искусства',
    description:
      'SynArteum — музей синтетического искусства. Три зала: карточная игра «Дурак» с сильным и ' +
      'честным компьютером, галерея снов Wish Me A Dream и кафе Wish Me Coffee.',
    museum: 'Музей синтетического искусства',
    lead: 'Три зала, где нейросети играют в карты, видят сны и варят кофе.',
    hall: 'Зал',
    exhibit: 'Экспонат',
    neurons: 'нейронов',
    k1: 'Синтетическая карточная игра',
    n1: 'Дурак',
    t1: 'Подкидной и переводной против соперников, которые считают карты, но не подглядывают. Пять уровней силы, девять характеров.',
    c1: 'Сесть за стол',
    k2: 'Синтетическая галерея',
    n2: 'Wish Me A Dream',
    t2: 'Тихая лента видений, приснившихся нейросети: сюрреалистическое барокко, по одной картине за раз.',
    c2: 'Войти в галерею',
    k3: 'Синтетическое кафе',
    n3: 'Wish Me Coffee',
    t3: 'Нарисованная чашка кофе с добрым пожеланием: утром, днём и на ночь. В Телеграме и в браузере.',
    c3: 'Заказать чашку',
    foot: 'Сделано человеком и нейросетями',
  },
  en: {
    title: 'SynArteum — a museum of synthetic art',
    description:
      'SynArteum is a museum of synthetic art with three halls: the card game Durak against a ' +
      'strong, fair computer, the dream gallery Wish Me A Dream and the café Wish Me Coffee.',
    museum: 'Synthetic art museum',
    lead: 'Three halls where neural networks play cards, dream in pictures and pour coffee.',
    hall: 'Hall',
    exhibit: 'Exhibit',
    neurons: 'neurons',
    k1: 'Synthetic card game',
    n1: 'Durak',
    t1: 'The Russian classic against opponents who count cards but never peek. Five levels of strength, nine characters.',
    c1: 'Take a seat',
    k2: 'Synthetic art gallery',
    n2: 'Wish Me A Dream',
    t2: 'A quiet feed of visions dreamt by a neural network: surreal baroque art, one image at a time.',
    c2: 'Enter the gallery',
    k3: 'Synthetic café',
    n3: 'Wish Me Coffee',
    t3: 'An illustrated cup of coffee with a heartfelt wish, matched to your time of day. On Telegram and in the browser.',
    c3: 'Order a cup',
    foot: 'Made by a human and neural networks',
  },
};
