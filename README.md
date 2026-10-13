# Дурак

A trainer for the card game Durak: you against one to three computer players, in the browser.

- Подкидной and переводной, 36 cards, 2 to 4 players.
- Nine named opponents in two styles of portrait, realistic and caricature, each with a skill
  rating from one to five stars. Pick one to three of them by face or by strength.
- Optional portraits that react to the game, remarks in each character's own voice, and
  reading the remarks aloud.
- A hint button that shows what the strong player would do in your seat (can be switched off).
- A Resign button on your turn; it asks once more before giving the game up.
- Who leads and who defends is written above each opponent's cards, and an arrow on the table
  (optional) runs from the one to the other.
- A beaten bout stays on the table until you clear it, so you can commit the cards to memory
  (or is cleared automatically, as an option). Clicking the discard pile lists what is in it.
- English and Russian.

## Running it

Needs [Node.js](https://nodejs.org) 20 or later.

On Windows, double-click `serve.bat`: it builds the game, serves it locally and opens the
browser. Otherwise:

```
npm install
npm run dev
```

and open the address it prints. `npm run build` writes a static site to `dist/`, which any web
server can host; `npm run preview` serves that build locally.

## Is the computer playing fair?

Yes, by construction. A computer player is never handed the game. It is handed an
`Observation` (`src/engine/observe.ts`): its own hand, the table, the discard pile, the trump
card, how many cards everyone holds, and the cards another player was seen to pick up. The
order of the deck and the other hands are not in it. In the browser the computer players run
in a separate worker, and that observation is the only thing sent across.

What it does with this is what a careful human does: it counts cards. Once the deck is empty
in a two-player game, counting tells each side exactly what the other holds, and the strong
player then calculates the rest of the game exactly.

`tests/fairness.test.ts` checks that the observation does not change when the hidden cards
are rearranged, and that the strong player's move depends on nothing else.

## Rules as implemented

- Six cards each; the bottom card of the deck shows the trump suit.
- In the first game with a line-up, the holder of the lowest trump leads and shows that card,
  so everyone knows where it is. Later games follow one of two customs, chosen in Settings:
  the winner of the previous game leads (the first player to have got rid of every card), or
  the player on the fool's right leads at the fool.
- A lead may be several cards of one rank. Everyone except the defender may throw in cards
  matching a rank on the table, the main attacker first.
- At most six attack cards in a bout (five until the first bout has been beaten, optional),
  and never more open cards than the defender holds.
- A defender who takes may be given more matching cards before picking up.
- Переводной: before beating anything, the defender may add a card of the same rank and pass
  the whole attack to the next player, provided that player holds enough cards to answer it.
- After a bout the attackers draw first, starting with whoever led; the defender draws last.
- The last player holding cards is the fool. If the last attack is beaten with the defender's
  last card, nobody is.

## How the strong player works

- `src/ai/heuristic.ts`: rule-of-thumb play (shed cheap cards, keep trumps). This is how the
  one- to three-star players move, and the playout policy for the search.
- `src/ai/search.ts`: information-set Monte Carlo tree search. Each iteration deals the unseen
  cards at random in a way consistent with the observation and plays the game out, so the
  choice rests on thousands of possible deals instead of one guess.
- `src/ai/endgame.ts`: exact solver for two players with an empty deck.

`npm run tournament -- 240 5 2 0 3` plays headless matches between ratings; the arguments
are games, the rating under test, players, transfer (0 or 1) and the opponents' rating.

## Opponents

| Stars | How they play | Fool rate against three stars |
|---|---|---|
| 1 | rules of thumb, a random move about one time in three | 73% |
| 2 | rules of thumb, a random move about one time in seven | 60% |
| 3 | rules of thumb, no slips | 50% by definition |
| 4 | looks ahead, but plays by rule of thumb one time in three | 37% |
| 5 | looks ahead on every move and solves two-player endgames exactly | 18% |

The rates are from two-player games of podkidnoy (2000 games for one and two stars, 240 for
four and five). Each character has a usual rating, and Boris is the only one who is usually
five stars; clicking a star in the roster sets any of them to any strength, and results are
tallied separately for each strength. The roster, with names, usual ratings and
which picture shows which mood, is `src/ui/characters.ts`; the remarks are in
`src/ui/phrases.ts`.

Portraits live in `public/avatars/<id>/0.webp` to `8.webp`: nine expressions per character,
cut from a three-by-three sheet. To add or replace a character, cut a new sheet the same way
and add an entry to the roster.

Russian remarks are spoken from clips in `public/voices/`, recorded ahead of time by a free
speech engine running locally. `npm run voices` records whatever is missing after lines are
added or edited; the casting and setup notes are at the top of `scripts/voices.mjs`. Two
engines are supported:

- **Silero** (the default), through the environment set up in the Gogol project, looked for
  in `../Gogol/app/tts` or wherever `DURAK_SILERO_DIR` points. Five voices, two male and three female, each at one of five pitches.
  The text is marked up the way Gogol does it: stress from its dictionary, written as a plus
  sign before the stressed vowel, and punctuation turned into SSML pauses. Words the
  dictionary cannot settle are ruled on in the script; `npm run voices -- --show` prints the
  marked-up lines so the stress can be checked by eye.
- **Piper** (`--engine piper`), installed under `tools/`, which is not committed. Four voices,
  three male and one female, told apart by pitch and pace.

English remarks, and any line without a clip, are read by the browser's built-in voices.

Sound follows three rules. Nothing is fetched unless speech is switched on, and then only the
clips of the opponents at the table. A clip is played only if it has already arrived. And
voices never overlap or queue: while one remark is being spoken, another goes unspoken.

## Options

All in Settings. The display options take effect at once.

- Portraits: off, still, or reacting to the game (on by default); optionally large.
- Opponents make remarks (on by default); speak the remarks aloud (off by default).
- Arrow from whoever leads to whoever defends (on by default).

The rest are off unless noted:

- Show opponents' cards you have already seen (a memory aid).
- Clear beaten cards automatically. Otherwise a beaten bout waits for the Clear button.
- Offer hints (on).
- Highlight the cards you can play. Without it the hand looks plain and an illegal card is
  refused with a small shake.
- Mark trump cards with a brass band.

## Deploying

The game is live at https://synarteum.com, served as static files by nginx. `deploy.bat` (or
`./deploy.sh`) builds the site, uploads it over SSH and swaps it into `/opt/durak/web`. The
server, key and port come from `deploy.env`, which is not committed; copy
`deploy.env.example` and fill it in.

`deploy/synarteum.conf` is only the bootstrap nginx site. The live copy in
`/etc/nginx/conf.d` has since been edited by certbot for HTTPS, and the deploy script leaves
it alone, so changes to headers must be made on the server.

## Card pictures

The jacks, queens, kings and aces in `public/cards/` are the Russian «атласные» designs drawn
by Dmitry Fomin, released into the public domain (CC0) on Wikimedia Commons, cut out of his
sheet "Atlasnye playing cards deck.svg". A card is named `rank_suit.svg` or `rank_suit.png`, for example
`king_hearts.svg`. Replace a file to change a picture; delete it and the card falls back to a
plain drawn face.

## Credits

- Card pictures: the «атласные» jacks, queens, kings and aces by Dmitry Fomin, public domain
  (CC0), from Wikimedia Commons.
- Voices: recorded with [Silero](https://github.com/snakers4/silero-models) text-to-speech.
  Its models carry their own licence, which restricts commercial use; check it before using
  the clips in `public/voices/` for anything commercial.
- Portraits: generated images of people who do not exist.
- Fonts: Oranienbaum and Golos Text, under the SIL Open Font License.

## Tests

```
npm test
```
