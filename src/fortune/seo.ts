import { PageLang, PageText, REPO } from '../seo';

// What the fortune-telling page says about itself, for search engines and in its "About" text.
// Like the game's texts in src/seo.ts, it is written into the pages when the site is built.

export const FORTUNE_PAGES: Record<PageLang, PageText> = {
  ru: {
    title: 'Гадание на картах онлайн — 36 карт и Ленорман, бесплатно',
    description:
      'Бесплатное гадание на игральных картах онлайн: карта дня, да или нет, на желание, цыганский расклад, ' +
      'а также Ленорман на обычной колоде. Карты вы вытягиваете сами из веера рубашкой вверх.',
    about: `
<h2>Гадание на картах онлайн</h2>
<p>Гадание на обычной колоде из 36 карт, бесплатно, прямо в браузере и без регистрации. Гадалка
тасует карты честно, колоду вы сдвигаете сами и сами вытягиваете карты из веера рубашкой вверх.</p>

<h3>Две системы</h3>
<ul>
<li><b>Игральные карты</b> — русская традиция: у каждой из 36 карт своё значение. Черви — чувства,
бубны — деньги и новости, трефы — дела, пики — трудности.</li>
<li><b>Ленорман</b> — оракул XIX века. На каждой карте Ленорман напечатана обычная игральная карта,
поэтому 36 картам колоды соответствуют 36 образов: Всадник, Клевер, Корабль и другие.</li>
</ul>

<h3>Расклады</h3>
<ul>
<li>Игральные карты: карта дня, да или нет, на желание, прошлое-настоящее-будущее, цыганский
расклад из девяти карт.</li>
<li>Ленорман: карта дня, линии из трёх и из пяти карт, квадрат девяти.</li>
</ul>

<h3>Правила</h3>
<ul>
<li>Один вопрос за раз; держите его в мыслях, пока карты тасуются.</li>
<li>Об одном и том же не спрашивают дважды в день. Тот же расклад в тот же день сначала покажет
прежний ответ; разложить заново можно, но уже по вашему решению.</li>
<li>Перевёрнутых карт нет: атласные карты одинаковы с обеих сторон.</li>
</ul>

<p>Гадание — развлечение, а не прогноз: научной основы у него нет. Не принимайте важных решений
по картам.</p>

<p class="fine">Конфиденциальность: вопрос, который вы пишете, остаётся в вашем браузере и никуда не
отправляется. Никаких cookie и трекеров. Сервер хранит стандартный временный журнал запросов с
IP-адресом и браузером и считает, сколько раскладов сделано. Сообщайте о проблемах здесь
<a href="${REPO}/issues" target="_blank" rel="noopener">github.com/Sorbiers/durak/issues</a>.</p>

<p class="fine">Исходный код открыт, лицензия MIT:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  en: {
    title: 'Fortune-telling with playing cards online — 36 cards and Lenormand, free',
    description:
      'Free fortune-telling with ordinary playing cards: card of the day, yes or no, a wish, the Gypsy spread, ' +
      'and Lenormand on an ordinary deck. You pick the cards yourself from a face-down fan.',
    about: `
<h2>Fortune-telling with playing cards</h2>
<p>Card reading with an ordinary 36-card deck, free, in the browser, with no sign-up. The
fortune-teller shuffles fairly, you cut the deck yourself and pick your own cards from a
face-down fan.</p>

<h3>Two systems</h3>
<ul>
<li><b>Playing cards</b>: the Russian tradition, in which each of the 36 cards has a meaning of its
own. Hearts are feelings, diamonds money and news, clubs work, spades difficulties.</li>
<li><b>Lenormand</b>: a 19th-century oracle. Every Lenormand card has an ordinary playing card
printed on it, so the 36 cards of the deck stand for 36 emblems: the Rider, the Clover, the Ship
and the rest.</li>
</ul>

<h3>Spreads</h3>
<ul>
<li>Playing cards: card of the day, yes or no, a wish, past-present-future, and the nine-card Gypsy
spread.</li>
<li>Lenormand: card of the day, lines of three and of five, and the box of nine.</li>
</ul>

<h3>Rules</h3>
<ul>
<li>One question at a time; keep it in mind while the cards are shuffled.</li>
<li>Nobody asks the same thing twice in a day. The same spread on the same day first shows the
earlier answer; you can deal again, but it is your call.</li>
<li>There are no reversed cards: the atlas cards look the same either way up.</li>
</ul>

<p>Fortune-telling is entertainment, not a forecast: it has no scientific basis. Do not make
important decisions by the cards.</p>

<p class="fine">Privacy: the question you type stays in your browser and is never sent anywhere. No
cookies and no trackers. The server keeps a standard temporary log of requests, with IP address and
browser, and counts how many readings are made. Report problems here:
<a href="${REPO}/issues" target="_blank" rel="noopener">github.com/Sorbiers/durak/issues</a>.</p>

<p class="fine">The source is open under the MIT licence:
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
  fr: {
    title: 'Cartomancie en ligne avec un jeu de 36 cartes et le Lenormand, gratuite',
    description:
      'Cartomancie gratuite avec des cartes à jouer : carte du jour, oui ou non, le vœu, le tirage tzigane, ' +
      'et le Lenormand sur un jeu ordinaire. Vous tirez vous-même vos cartes dans un éventail face cachée.',
    about: `
<h2>Cartomancie en ligne</h2>
<p>Tirage des cartes avec un jeu ordinaire de 36 cartes, gratuit, dans le navigateur, sans
inscription. La cartomancienne bat les cartes loyalement, vous coupez vous-même le jeu et tirez
vos cartes dans un éventail face cachée.</p>

<h3>Deux systèmes</h3>
<ul>
<li><b>Cartes à jouer</b> : la tradition russe, où chacune des 36 cartes a son sens. Cœur pour les
sentiments, carreau pour l’argent et les nouvelles, trèfle pour le travail, pique pour les
difficultés.</li>
<li><b>Lenormand</b> : un oracle du XIXe siècle. Chaque carte Lenormand porte une carte à jouer
imprimée, si bien que les 36 cartes du jeu correspondent à 36 emblèmes : le Cavalier, le Trèfle,
le Navire et les autres.</li>
</ul>

<h3>Tirages</h3>
<ul>
<li>Cartes à jouer : carte du jour, oui ou non, le vœu, passé-présent-avenir et le tirage tzigane
à neuf cartes.</li>
<li>Lenormand : carte du jour, lignes de trois et de cinq, carré de neuf.</li>
</ul>

<h3>Règles</h3>
<ul>
<li>Une question à la fois ; gardez-la en tête pendant que l’on bat les cartes.</li>
<li>On ne pose pas deux fois la même question le même jour. Le même tirage, le même jour, montre
d’abord la réponse déjà donnée ; vous pouvez retirer, mais c’est votre choix.</li>
<li>Pas de cartes renversées : les figures du jeu atlas sont les mêmes dans les deux sens.</li>
</ul>

<p>La cartomancie est un divertissement, pas une prévision : elle n’a aucun fondement scientifique.
Ne prenez pas de décisions importantes d’après les cartes.</p>

<p class="fine">Confidentialité : la question que vous tapez reste dans votre navigateur et n’est jamais
envoyée. Ni cookies ni traceurs. Le serveur conserve un journal temporaire standard des requêtes,
avec l’adresse IP et le navigateur, et compte le nombre de tirages. Signalez les problèmes ici :
<a href="${REPO}/issues" target="_blank" rel="noopener">github.com/Sorbiers/durak/issues</a>.</p>

<p class="fine">Le code source est ouvert, sous licence MIT :
<a href="${REPO}" target="_blank" rel="noopener">github.com/Sorbiers/durak</a></p>`,
  },
};
