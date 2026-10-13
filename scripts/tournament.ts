// Headless matches between computer players, to measure how strong they are.
//   npm run tournament -- [games] [rating] [players] [transfer: 0|1] [opponent rating]
// One seat plays at the first rating (1 to 5); the others play at the opponent rating.
// The tested seat rotates. Ratings 4 and 5 search; append :N to set the search size.
import { Rating } from '../src/ai';
import { DRAW } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';
import { aiPolicy, playGame } from '../src/sim/play';

declare const process: { argv: string[] };

const args = process.argv.slice(2);
const games = Number(args[0] ?? 100);
const players = Number(args[2] ?? 2);
const rules = { players, transfer: args[3] === '1', firstBoutFive: true };
const policy = (spec: string) => {
  const [rating, iterations] = spec.split(':').map(Number);
  return aiPolicy(rating as Rating, iterations || 2000);
};
const tested = policy(args[1] ?? '5');
const other = policy(args[4] ?? '3');

let testedFool = 0;
let otherFool = 0;
let draws = 0;
const started = performance.now();
for (let g = 0; g < games; g++) {
  const seat = g % players;
  const policies = Array.from({ length: players }, (_, p) => (p === seat ? tested : other));
  const s = playGame(rules, policies, mulberry32(g + 1));
  if (s.loser === DRAW) draws++;
  else if (s.loser === seat) testedFool++;
  else otherFool++;
}
const secs = (performance.now() - started) / 1000;
const pct = (x: number) => ((100 * x) / games).toFixed(1) + '%';
console.log(
  `${players} players, ${rules.transfer ? 'transfer' : 'simple'}, rating ${args[1] ?? '5'} vs ${args[4] ?? '3'}, ${games} games in ${secs.toFixed(0)}s`,
);
console.log(`  tested seat is the fool: ${pct(testedFool)}   (an even field would give ${pct(games / players)})`);
console.log(`  another seat is the fool: ${pct(otherFool)}   draws: ${pct(draws)}`);
