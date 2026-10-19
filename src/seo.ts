// What the site says about itself: page titles and descriptions for search engines, the front
// page's texts and the game's "About" text. All of it is written into the pages when the site
// is built, so that it can be read without running any script; the pages' scripts use the
// same texts when the language is switched.

export const SITE = 'https://synarteum.com/';
/** The games' folders on the site. */
export const GAME = `${SITE}durak/`;
export const KOZEL = `${SITE}kozel/`;
export const POKER = `${SITE}poker/`;
export const REPO = 'https://github.com/Sorbiers/durak';

export type PageLang = 'ru' | 'en' | 'fr';

/** The site's languages, in the order the language switch goes round them. */
export const LANGS: PageLang[] = ['ru', 'en', 'fr'];

/** The languages a page in `lang` offers to switch to, the next one round first. */
export function otherLangs(lang: PageLang): PageLang[] {
  const at = LANGS.indexOf(lang);
  return LANGS.map((_, step) => LANGS[(at + step) % LANGS.length]).slice(1);
}

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
<li>Русский, английский и французский язык.</li>
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
искусства. Сыграйте и в <a href="${KOZEL}ru/">козла</a>. Исходный код открыт, лицензия MIT:
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
<li>Russian, English and French.</li>
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
synthetic art. Try <a href="${KOZEL}en/">Kozel</a> too. The source is open under the MIT licence:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  fr: {
    title: 'Dourak en ligne — le jeu de cartes russe contre un ordinateur fort',
    description:
      'Jouez au dourak, le classique russe, gratuitement dans le navigateur : 2 à 4 joueurs, 36 cartes. ' +
      'Un ordinateur fort et loyal, qui ne voit ni votre main ni le talon.',
    about: `
<h2>Dourak en ligne</h2>
<p>Le dourak (« le sot ») est le jeu de cartes russe le plus connu. Personne n’y gagne : le
dernier joueur à qui il reste des cartes a perdu, c’est lui le dourak. Chacun attaque à son tour
son voisin de gauche ; le défenseur doit battre chaque carte avec une carte plus forte de la même
couleur ou avec un atout, et s’il ne peut pas ou ne veut pas, il ramasse tout ce qui est sur la
table.</p>
<p>Ici, on y joue gratuitement dans le navigateur, sans inscription ni publicité : en tête-à-tête,
ou à trois ou quatre contre des adversaires artificiels.</p>

<h3>Un adversaire fort et loyal</h3>
<p>L’ordinateur ne triche pas : il ne connaît jamais l’ordre du talon ni les cartes des autres.
Les joueurs forts font ce que fait une personne attentive : ils comptent les cartes sorties, se
souviennent de qui a ramassé quoi et calculent plusieurs coups à l’avance. Quand le talon est
épuisé dans une partie à deux, la fin est calculée exactement.</p>

<h3>Ce que contient le jeu</h3>
<ul>
<li>Dourak podkidnoï (où l’on ajoute des cartes) et perevodnoï (où l’on transfère l’attaque), jeu
de 36 cartes, de deux à quatre joueurs.</li>
<li>Neuf adversaires qui ont chacun leur caractère et cinq niveaux de force, du débutant au
maître ; le niveau de chacun se règle séparément.</li>
<li>Portraits, remarques à table et voix (en russe) : tout est facultatif.</li>
<li>Un conseil pour le coup à jouer, la vue de la défausse, le décompte des victoires et des
défaites.</li>
<li>En russe, en anglais et en français.</li>
</ul>

<h3>Règles</h3>
<ul>
<li>Six cartes chacun ; la dernière carte du talon indique l’atout.</li>
<li>À la première partie, celui qui a le plus petit atout attaque et le montre. Ensuite, selon le
réglage choisi : le gagnant de la partie précédente attaque, ou bien on attaque le dourak.</li>
<li>On attaque avec une carte, ou avec plusieurs de même valeur. Tous, sauf le défenseur, peuvent
ajouter des cartes d’une valeur déjà présente sur la table.</li>
<li>Pas plus de six cartes par attaque (cinq tant que la première attaque n’a pas été battue ;
c’est réglable), et jamais plus que le défenseur n’a de cartes.</li>
<li>À un défenseur qui ramasse, on peut encore donner des cartes qui conviennent.</li>
<li>Dans la variante perevodnoï, avant d’avoir battu quoi que ce soit, le défenseur peut poser une
carte de même valeur et transférer l’attaque au joueur suivant.</li>
<li>Après une attaque, chacun complète sa main à six cartes : d’abord les attaquants, en
commençant par celui qui a ouvert, le défenseur en dernier.</li>
<li>Le dernier à garder des cartes est le dourak. Si la dernière attaque est battue avec la
dernière carte du défenseur, il n’y a pas de dourak : partie nulle.</li>
</ul>

<p class="fine">Le jeu est l’une des salles de <a href="${SITE}fr/">SynArteum</a>, un musée d’art
synthétique. Essayez aussi le <a href="${KOZEL}fr/">kozel</a>. Le code source est ouvert, sous licence MIT :
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
};

/** Where the front page's halls lead, besides the games on this site. */
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
      'SynArteum — музей синтетического искусства. Три зала: галерея снов Wish Me A Dream, кафе ' +
      'Wish Me Coffee и карточные игры — «Дурак», «Козёл» и покер — с сильным и честным компьютером.',
    museum: 'Музей синтетического искусства',
    lead: 'Три зала, где нейросети видят сны, варят кофе и играют в карты.',
    hall: 'Зал',
    exhibit: 'Экспонат',
    neurons: 'нейронов',
    k1: 'Синтетические игры',
    n1: 'Чилаут',
    t1: '«Дурак», «Козёл» и техасский холдем против соперников, которые считают карты, но не подглядывают. Пять уровней силы, девять характеров.',
    c1: 'Играть в дурака',
    c1b: 'Играть в козла',
    c1c: 'Играть в покер',
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
      'SynArteum is a museum of synthetic art with three halls: the dream gallery Wish Me A Dream, ' +
      'the café Wish Me Coffee and the card games Durak, Kozel and Texas Hold’em against a strong, fair computer.',
    museum: 'Synthetic art museum',
    lead: 'Three halls where neural networks dream in pictures, pour coffee and play cards.',
    hall: 'Hall',
    exhibit: 'Exhibit',
    neurons: 'neurons',
    k1: 'Synthetic games',
    n1: 'Chillout',
    t1: 'Durak, Kozel and Texas Hold’em against opponents who count cards but never peek. Five levels of strength, nine characters.',
    c1: 'Play Durak',
    c1b: 'Play Kozel',
    c1c: 'Play poker',
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
  fr: {
    title: 'SynArteum — un musée d’art synthétique',
    description:
      'SynArteum est un musée d’art synthétique en trois salles : la galerie de rêves Wish Me A Dream, ' +
      'le café Wish Me Coffee et les jeux de cartes Dourak, Kozel et Texas Hold’em contre un ordinateur fort et loyal.',
    museum: 'Musée d’art synthétique',
    lead: 'Trois salles où des réseaux de neurones rêvent en images, servent le café et jouent aux cartes.',
    hall: 'Salle',
    exhibit: 'Pièce',
    neurons: 'neurones',
    k1: 'Jeux synthétiques',
    n1: 'Chillout',
    t1: 'Dourak, Kozel et Texas Hold’em contre des adversaires qui comptent les cartes mais ne trichent jamais. Cinq niveaux de force, neuf personnages.',
    c1: 'Jouer au dourak',
    c1b: 'Jouer au kozel',
    c1c: 'Jouer au poker',
    k2: 'Galerie d’art synthétique',
    n2: 'Wish Me A Dream',
    t2: 'Un fil paisible de visions rêvées par un réseau de neurones : un baroque surréaliste, une image à la fois.',
    c2: 'Entrer dans la galerie',
    k3: 'Café synthétique',
    n3: 'Wish Me Coffee',
    t3: 'Une tasse de café illustrée et un vœu sincère, selon l’heure de votre journée. Sur Telegram et dans le navigateur.',
    c3: 'Commander une tasse',
    foot: 'Fait par un humain et des réseaux de neurones',
  },
};

/** Kozel's page: its title, description and "About" text. */
export const KOZEL_PAGES: Record<PageLang, PageText> = {
  ru: {
    title: 'Козёл онлайн — карточная игра пара на пару против компьютера',
    description:
      'Козёл онлайн бесплатно и без регистрации: игра вчетвером, пара на пару, 36 карт, взятки и ' +
      'очки. Вы и партнёр против двух соперников; компьютер не видит ваши карты.',
    about: `
<h2>Козёл онлайн</h2>
<p>«Козёл» — старая русская игра на взятки для двух пар. Партнёры сидят друг напротив друга и
вместе набирают очки во взятках; пара, проигравшая раздачи до двенадцати очков, становится
козлами. Здесь вы играете в паре с компьютерным партнёром против двух компьютерных соперников —
бесплатно, в браузере, без регистрации и рекламы.</p>

<h3>Правила</h3>
<ul>
<li>Колода 36 карт, каждому по четыре. Следующая карта открывается и показывает козырь; она
ложится под колоду и достаётся последней.</li>
<li>Порядок карт в масти: туз, десятка, король, дама, валет, девятка, восьмёрка, семёрка,
шестёрка. Очки: туз 11, десятка 10, король 4, дама 3, валет 2, остальные 0; всего 120.</li>
<li>Ходят одной картой или несколькими одной масти. Каждый следующий кладёт столько же карт —
любых. Если его карты бьют лучший заход (каждая карта бита своей: старшей той же масти или
козырем), он кладёт их в открытую и перебивает; если нет — кладёт в закрытую. Бить не
обязательно.</li>
<li>Взятку забирает тот, чей заход лучший, и ходит следующим. После взятки все добирают до
четырёх, начиная со взявшего, — пока хватает колоды, всем поровну.</li>
<li>После раздачи пара, набравшая меньше очков, получает штраф: 2, если у неё 31 очко и больше;
4, если меньше; 6, если она не взяла ни одной взятки. При 60 на 60 («яйца») штрафа нет.</li>
<li>Пара, набравшая 12 штрафных очков, — козлы. Сдаёт каждый по очереди.</li>
</ul>
<p>У «Козла» много местных вариантов: со «шамой», с постоянными козырями, с объявлениями.
Здесь — простой вариант с добором из колоды.</p>

<h3>Что есть в игре</h3>
<ul>
<li>Те же девять персонажей, что и в «Дураке», с пятью уровнями силы, портретами, репликами и
озвучкой.</li>
<li>Честный компьютер: он видит только свои карты и то, что сыграно в открытую. Сильные игроки
просчитывают раздачу вперёд.</li>
<li>Подсказка хода и игра в открытую — для тренировки.</li>
</ul>

<p class="fine">Игра — один из залов <a href="${SITE}ru/">SynArteum</a>, музея синтетического
искусства. Сыграйте и в <a href="${GAME}ru/">дурака</a>. Исходный код открыт, лицензия MIT:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  en: {
    title: 'Kozel online — the Russian card game for two pairs, against the computer',
    description:
      'Play Kozel ("the goat"), the Russian trick-taking card game for two pairs, free in your ' +
      'browser. You and a computer partner against two computer opponents; 36 cards, tricks and points.',
    about: `
<h2>Kozel online</h2>
<p>Kozel (“the goat”) is an old Russian trick-taking game for two pairs. Partners sit opposite
each other and score points in the tricks they take together; the pair that loses deals up to
twelve penalty points are the goats. Here you play with a computer partner against two computer
opponents, free in the browser, with no sign-up and no ads.</p>

<h3>Rules</h3>
<ul>
<li>A 36-card deck, four cards each. The next card is turned up for trumps; it goes under the
deck and is drawn last.</li>
<li>Order within a suit: ace, ten, king, queen, jack, nine, eight, seven, six. Points: ace 11,
ten 10, king 4, queen 3, jack 2, the rest nothing; 120 in all.</li>
<li>A lead is one card, or several of one suit. Each player in turn plays as many cards, of any
suits. If they beat the best play so far, each card beaten by a different one, a higher card of
its suit or a trump, they go down face up and take over the trick; otherwise they go down face
down. Nobody has to beat.</li>
<li>The best play takes the trick and leads next. After each trick everyone draws back up to
four, the winner first, as far as the deck goes with everyone getting the same number.</li>
<li>After the deal the pair with fewer points is charged: 2 if they took 31 or more, 4 if less,
6 if they took no trick. At 60 all (“eggs”) nobody is charged.</li>
<li>A pair charged 12 in all are the goats. The deal passes round the table.</li>
</ul>
<p>Kozel has many local variants, with permanent trumps, special cards or declarations. This is
the plain version with drawing from the deck.</p>

<h3>What is in the game</h3>
<ul>
<li>The same nine characters as in Durak, with five levels of strength, portraits, table talk
and Russian voice lines.</li>
<li>A fair computer: it sees only its own cards and what has been played face up. The strong
players look ahead through the deal.</li>
<li>A hint for the move and open cards, for training.</li>
</ul>

<p class="fine">The game is one of the halls of <a href="${SITE}en/">SynArteum</a>, a museum of
synthetic art. Try <a href="${GAME}en/">Durak</a> too. The source code is open, under the MIT
licence: <a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  fr: {
    title: 'Kozel en ligne — le jeu de cartes russe à deux contre deux',
    description:
      'Jouez au Kozel (« le bouc »), le jeu de levées russe à deux contre deux, gratuitement dans ' +
      'votre navigateur. Vous et un partenaire artificiel contre deux adversaires ; 36 cartes, plis et points.',
    about: `
<h2>Kozel en ligne</h2>
<p>Le Kozel (« le bouc ») est un vieux jeu de levées russe pour deux équipes de deux. Les
partenaires sont assis face à face et marquent ensemble les points des plis qu’ils prennent ;
l’équipe qui perd les donnes jusqu’à douze points de pénalité devient « les boucs ». Ici, vous
jouez avec un partenaire artificiel contre deux adversaires artificiels, gratuitement dans le
navigateur, sans inscription ni publicité.</p>

<h3>Règles</h3>
<ul>
<li>Un jeu de 36 cartes, quatre cartes chacun. La carte suivante est retournée pour l’atout ;
elle va sous le talon et sera piochée en dernier.</li>
<li>Ordre dans une couleur : as, dix, roi, dame, valet, neuf, huit, sept, six. Points : as 11,
dix 10, roi 4, dame 3, valet 2, les autres rien ; 120 en tout.</li>
<li>On entame avec une carte, ou plusieurs de la même couleur. Chacun à son tour pose autant de
cartes, de n’importe quelles couleurs. Si elles battent la meilleure mise, chaque carte par une
autre, plus forte de sa couleur ou atout, elles sont posées face visible et prennent la main ;
sinon elles sont posées face cachée. Personne n’est obligé de battre.</li>
<li>La meilleure mise prend le pli et entame le suivant. Après chaque pli, chacun complète sa
main à quatre, le preneur d’abord, tant que le talon le permet, tous autant.</li>
<li>Après la donne, l’équipe qui a le moins de points est pénalisée : 2 si elle a 31 points ou
plus, 4 sinon, 6 si elle n’a pris aucun pli. À 60 partout (« les œufs »), personne n’est
pénalisé.</li>
<li>L’équipe qui atteint 12 points de pénalité devient « les boucs ». La donne tourne.</li>
</ul>
<p>Le Kozel a de nombreuses variantes locales, avec atouts permanents, cartes spéciales ou
annonces. Voici la version simple, avec pioche dans le talon.</p>

<h3>Ce que contient le jeu</h3>
<ul>
<li>Les neuf personnages du Dourak, avec cinq niveaux de force, portraits, remarques et voix
russes.</li>
<li>Un ordinateur loyal : il ne voit que ses propres cartes et ce qui est joué face visible.
Les joueurs forts calculent la donne à l’avance.</li>
<li>Un conseil pour le coup et le jeu à cartes ouvertes, pour s’entraîner.</li>
</ul>

<p class="fine">Le jeu est l’une des salles de <a href="${SITE}fr/">SynArteum</a>, un musée d’art
synthétique. Essayez aussi le <a href="${GAME}fr/">dourak</a>. Le code source est ouvert, sous
licence MIT : <a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
};

/** The poker page: its title, description and "About" text. */
export const POKER_PAGES: Record<PageLang, PageText> = {
  ru: {
    title: 'Покер онлайн — техасский холдем против компьютера, бесплатно',
    description:
      'Техасский холдем бесплатно и без регистрации: турнир на выбывание против 1–5 соперников, ' +
      'безлимитные ставки, растущие блайнды. Честный компьютер не видит ваших карт.',
    about: `
<h2>Покер онлайн: техасский холдем</h2>
<p>Техасский холдем — самый популярный вид покера. Здесь он сыгран как небольшой турнир:
у всех поровну фишек, блайнды растут, проигравшие все фишки выбывают, побеждает тот, кто
забрал всё. Играть можно бесплатно, в браузере, без регистрации и рекламы, против одного —
пяти компьютерных соперников. Фишки ненастоящие, ставок на деньги нет.</p>

<h3>Правила</h3>
<ul>
<li>Каждому сдают две закрытые карты. Двое слева от баттона ставят блайнды: малый и большой.</li>
<li>Четыре круга торговли: до флопа, после флопа (три общие карты), тёрна (четвёртая) и
ривера (пятая). Можно сбросить карты, уравнять (колл), пропустить (чек), поставить или
повысить (рейз) — без ограничения суммы, вплоть до всех фишек (олл-ин).</li>
<li>Если ставку не уравнял никто, банк забирает поставивший. Иначе на вскрытии выигрывает
лучшая комбинация из пяти карт: своих двух и пяти общих.</li>
<li>Комбинации по старшинству: стрит-флеш, каре, фулл-хаус, флеш, стрит, тройка, две пары,
пара, старшая карта.</li>
<li>Кто пошёл олл-ин, борется только за ту часть банка, которую мог покрыть; остальное
разыгрывают другие (побочные банки).</li>
<li>Блайнды растут каждые восемь раздач. Стартовый стек — 1000 фишек.</li>
</ul>

<h3>Что есть в игре</h3>
<ul>
<li>Те же девять персонажей, что в «Дураке» и «Козле», с пятью уровнями силы, портретами,
репликами и озвучкой.</li>
<li>Честный компьютер: он видит только свои две карты, стол и ставки. Сильные игроки
просчитывают шансы и учитывают, что крупная ставка обычно что-то значит.</li>
<li>Для тренировки — ваш шанс выиграть раздачу, подсказка хода и игра в открытую.</li>
</ul>

<p class="fine">Игра — один из залов <a href="${SITE}ru/">SynArteum</a>, музея синтетического
искусства. Сыграйте и в <a href="${GAME}ru/">дурака</a> или <a href="${KOZEL}ru/">козла</a>.
Исходный код открыт, лицензия MIT:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  en: {
    title: 'Texas Hold’em poker online — free, against the computer',
    description:
      'Play Texas Hold’em free in your browser: a sit-and-go tournament against one to five ' +
      'computer opponents, no-limit betting, rising blinds. A fair computer that never sees your cards.',
    about: `
<h2>Texas Hold’em online</h2>
<p>Texas Hold’em is the most popular form of poker. Here it is played as a small tournament:
everyone starts with the same chips, the blinds rise, players who lose all their chips are out,
and the one who takes them all wins. Play free in the browser, with no sign-up and no ads,
against one to five computer opponents. The chips are not real and nothing is played for money.</p>

<h3>Rules</h3>
<ul>
<li>Everyone gets two cards face down. The two players left of the button post the small and
big blinds.</li>
<li>Four rounds of betting: before the flop, after the flop (three shared cards), after the turn
(a fourth) and after the river (a fifth). You may fold, call, check, bet or raise, with no limit,
up to all your chips (all in).</li>
<li>A bet nobody calls takes the pot. Otherwise the best five-card hand at the showdown wins,
made from your two cards and the five on the board.</li>
<li>Hands from the best: straight flush, four of a kind, full house, flush, straight, three of a
kind, two pair, a pair, high card.</li>
<li>A player who is all in can win only as much as they covered; the rest is played for by the
others in side pots.</li>
<li>The blinds rise every eight hands. Everyone starts with 1000 chips.</li>
</ul>

<h3>What is in the game</h3>
<ul>
<li>The same nine characters as in Durak and Kozel, with five levels of strength, portraits,
table talk and Russian voice lines.</li>
<li>A fair computer: it sees only its own two cards, the board and the betting. The strong
players weigh their chances and allow for a big bet usually meaning something.</li>
<li>For training: your chance of winning the hand, a hint for the move, and open cards.</li>
</ul>

<p class="fine">The game is one of the halls of <a href="${SITE}en/">SynArteum</a>, a museum of
synthetic art. Try <a href="${GAME}en/">Durak</a> or <a href="${KOZEL}en/">Kozel</a> too. The
source code is open, under the MIT licence:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  fr: {
    title: 'Poker Texas Hold’em en ligne — gratuit, contre l’ordinateur',
    description:
      'Jouez au Texas Hold’em gratuitement dans votre navigateur : un tournoi contre un à cinq ' +
      'adversaires artificiels, sans limite, blindes croissantes. Un ordinateur loyal qui ne voit jamais vos cartes.',
    about: `
<h2>Texas Hold’em en ligne</h2>
<p>Le Texas Hold’em est la forme de poker la plus jouée. Ici, il se joue en petit tournoi :
tout le monde commence avec les mêmes jetons, les blindes montent, ceux qui perdent tous leurs
jetons sont éliminés, et celui qui les prend tous gagne. Gratuit, dans le navigateur, sans
inscription ni publicité, contre un à cinq adversaires artificiels. Les jetons ne sont pas réels
et on ne joue pas d’argent.</p>

<h3>Règles</h3>
<ul>
<li>Chacun reçoit deux cartes face cachée. Les deux joueurs à gauche du bouton posent la petite
et la grosse blinde.</li>
<li>Quatre tours d’enchères : avant le flop, après le flop (trois cartes communes), après le
turn (une quatrième) et après la river (une cinquième). On peut se coucher, suivre, parler,
miser ou relancer, sans limite, jusqu’à tous ses jetons (tapis).</li>
<li>Une mise que personne ne suit remporte le pot. Sinon, la meilleure main de cinq cartes à
l’abattage gagne, faite de vos deux cartes et des cinq du tableau.</li>
<li>Les mains, de la meilleure : quinte flush, carré, full, couleur, quinte, brelan, deux paires,
une paire, carte haute.</li>
<li>Un joueur à tapis ne peut gagner que ce qu’il a couvert ; le reste se joue entre les autres
dans des pots annexes.</li>
<li>Les blindes montent toutes les huit mains. Chacun commence avec 1000 jetons.</li>
</ul>

<h3>Ce que contient le jeu</h3>
<ul>
<li>Les neuf personnages du Dourak et du Kozel, avec cinq niveaux de force, portraits,
remarques et voix russes.</li>
<li>Un ordinateur loyal : il ne voit que ses deux cartes, le tableau et les mises. Les joueurs
forts pèsent leurs chances et savent qu’une grosse mise veut souvent dire quelque chose.</li>
<li>Pour s’entraîner : votre chance de gagner la main, un conseil pour le coup et le jeu à
cartes ouvertes.</li>
</ul>

<p class="fine">Le jeu est l’une des salles de <a href="${SITE}fr/">SynArteum</a>, un musée d’art
synthétique. Essayez aussi le <a href="${GAME}fr/">dourak</a> ou le <a href="${KOZEL}fr/">kozel</a>.
Le code source est ouvert, sous licence MIT :
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
};
