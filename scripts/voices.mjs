// Records a voice clip for every Russian remark, once, with a free speech engine that runs on
// this computer. The game then plays these files in place of the browser's own voice.
// English remarks keep using the browser's voice.
//
//   npm run voices -- [--engine silero|piper] [--only boris,vera] [--redo] [--dry] [--show]
//
// --engine  which voices to use (default silero)
// --only    just these characters
// --redo    record again even where a clip exists (after changing a voice below)
// --dry     say what would be recorded and do nothing
// --show    print the marked-up text the engine would be given, and record nothing
//
// Both engines need ffmpeg on the PATH.
//
// silero: the Silero voices set up in the Gogol project (looked for beside this one, in
//   ../Gogol/app/tts; see its
//   setup_env.bat), together with its stress dictionary. Point DURAK_SILERO_DIR at another
//   copy if it lives elsewhere.
// piper: one-time setup from this folder, with Python 3:
//   python -m venv tools/piper/venv
//   tools/piper/venv/Scripts/python -m pip install piper-tts
//   tools/piper/venv/Scripts/python -m piper.download_voices --data-dir tools/piper/voices \
//     ru_RU-denis-medium ru_RU-dmitri-medium ru_RU-irina-medium ru_RU-ruslan-medium
//
// Output: public/durak/voices/<character>/ru/<name>.mp3 and public/durak/voices/index.json.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../src/ui/characters.ts';
import { clipName, linesFor } from '../src/ui/phrases.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'public', 'durak', 'voices');
const LANG = 'ru';
const venvPython = (dir) => join(dir, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

const args = process.argv.slice(2);
const option = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const dry = args.includes('--dry');
const redo = args.includes('--redo');
const show = args.includes('--show');
const only = option('only')?.split(',');
const engineName = option('engine') ?? 'silero';

// ---------------------------------------------------------------------------- Silero
// Five voices: aidar and eugene are men; baya, kseniya and xenia are women. Each takes one
// of five pitches (x-low, low, medium, high, x-high), which are the model's own and so sound
// natural, but are wide steps: about a sixth up or down each. Measured medians, in Hz:
//   aidar 81 105 131 151 176   eugene 80 81 99 120 144
//   baya 171 200 247 293 343   kseniya 157 204 247 298 342   xenia 143 176 207 245 284
// `tempo` is a finer speed change applied afterwards (1 = as spoken, lower = slower).
const SILERO_DIR = process.env.DURAK_SILERO_DIR ?? join(ROOT, '..', 'Gogol', 'app', 'tts');
const SILERO_CAST = {
  boris: { speaker: 'eugene', pitch: 'medium', tempo: 0.95 }, // deep and unhurried
  vera: { speaker: 'xenia', pitch: 'medium', tempo: 1 }, // soft
  gleb: { speaker: 'aidar', pitch: 'medium', tempo: 1.02 }, // hearty
  lev: { speaker: 'aidar', pitch: 'low', tempo: 0.9 }, // old and slow
  tamara: { speaker: 'kseniya', pitch: 'low', tempo: 0.97 }, // clear, lower, measured
  anton: { speaker: 'eugene', pitch: 'high', tempo: 1.06 }, // young and brisk
  fyodor: { speaker: 'eugene', pitch: 'low', tempo: 0.97 }, // a low grumble
  lyuba: { speaker: 'baya', pitch: 'medium', tempo: 1.05 }, // bright and quick
  kostya: { speaker: 'aidar', pitch: 'x-high', tempo: 1.08 }, // a teenager
};
// The text is prepared the way the Gogol project prepares its own (rut2s.js): stress is
// marked with a plus sign before the stressed vowel, taken from Gogol's dictionary of 900,000
// word forms, and punctuation becomes SSML pauses. The dictionary leaves alone any word it
// knows with two stresses, and lacks some words altogether; those that occur in the remarks
// are settled here, each in the sense it has in its line.
const STRESS = {
  // two stresses in the dictionary
  случай: 'сл+учай', начала: 'нач+ала', крою: 'кр+ою', переводной: 'переводн+ой',
  копите: 'коп+ите', торопитесь: 'тороп+итесь', спешить: 'спеш+ить', борозды: 'борозд+ы',
  уже: 'уж+е', учитесь: 'уч+итесь', простоты: 'простот+ы', головы: 'голов+ы', смело: 'см+ело',
  дома: 'д+ома', собрались: 'собрал+ись', урок: 'ур+ок', личного: 'л+ичного',
  допустим: 'доп+устим', пропадать: 'пропад+ать', правилам: 'пр+авилам',
  // not in the dictionary
  отбито: 'отб+ито', предсказуемо: 'предсказ+уемо', потрачен: 'потр+ачен',
  планировалось: 'планир+овалось', сыграна: 'с+ыграна', кого: 'ког+о', добора: 'доб+ора',
  эндшпиль: '+эндшпиль', прикуп: 'пр+икуп', будешь: 'б+удешь', довесочек: 'дов+есочек',
  переадресован: 'переадрес+ован', неуд: 'н+еуд', сработано: 'сраб+отано', ними: 'н+ими',
  гостинчик: 'гост+инчик', опа: '+опа', вау: 'в+ау', стариковски: 'старик+овски',
  // wrong in the dictionary for the sense used here
  сочи: 'с+очи', // the town
};
const VOWELS = /[аеёиоуыэюя]/i;
let dictionary;

/** One word with its stress marked, or as it was if nothing is known about it. */
function stressWord(word) {
  const key = word.toLowerCase();
  let marked = STRESS[key];
  if (!marked && key.includes('ё')) marked = key.replace('ё', '+ё'); // ё is always stressed
  if (!marked) {
    dictionary ??= JSON.parse(readFileSync(join(SILERO_DIR, 'russian_stress_dictionary.json'), 'utf8'));
    const forms = dictionary[key];
    if (forms?.length !== 1) return word; // unknown, or two stresses and no ruling above
    // The dictionary puts an apostrophe after the stressed vowel.
    const at = forms[0].indexOf("'");
    const bare = forms[0].replace("'", '');
    let i = at - 1;
    while (i > 0 && !VOWELS.test(bare[i])) i--;
    marked = at < 0 ? bare : `${bare.slice(0, i)}+${bare.slice(i)}`;
  }
  if (word[0] === word[0].toLowerCase()) return marked;
  const lead = marked.startsWith('+') ? 1 : 0; // keep the capital, after the plus if it leads
  return marked.slice(0, lead) + marked[lead].toUpperCase() + marked.slice(lead + 1);
}

/** Marks the stress in every word; the halves of a hyphenated word are taken separately. */
function stress(text) {
  return text.replace(/[а-яё]+/gi, (word) => stressWord(word));
}

/** Punctuation to SSML pauses, as Gogol's textToSsmlRuSimple does it. */
function pauses(text) {
  const comma = 200;
  return text
    .replace(/…/g, '...')
    .replace(/\.\.\./g, '<break time="450ms"/>')
    .replace(/,\s+(?=(как|о|когд\+а)\s)/giu, `,<break time="${comma - 40}ms"/> `)
    .replace(/,\s+(?=(конечно|наверное|возможно|кажется|кстати|что|например|видимо|пожалуй)\s)/giu, `,<break time="${comma - 20}ms"/> `)
    .replace(/,\s+(?=(но|а|однако|зато|хотя|и)\s)/giu, `,<break time="${comma + 40}ms"/> `)
    .replace(/;(\s*)/g, ';<break time="220ms"/>')
    .replace(/:(\s*)/g, ':<break time="200ms"/>')
    .replace(/\s[—-]\s/g, (m) => `${m}<break time="160ms"/>`)
    .replace(/([.?!])(\s+|$)/g, '$1<break time="350ms"/>$2')
    // Gogol strings sentences together, so each ends in a pause. A clip is one remark: a
    // pause at its very end is only dead air, and at an altered pitch it is not even silent.
    .replace(/(<break time="\d+ms"\/>\s*)+$/, '');
}

/** A remark as the SSML handed to Silero, at a character's pitch. */
function ssml(text, pitch) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const spelled = escaped
    .replace(/ну-с/gi, 'нус') // otherwise the letter is spelled out
    .replace(/…\s*$/, '.'); // trailing off at the end of a remark is just its end
  return `<speak><prosody rate="medium" pitch="${pitch}">${pauses(stress(spelled))}</prosody></speak>`;
}

const silero = {
  ready: () => existsSync(venvPython(SILERO_DIR)),
  missing: `Silero is not set up in ${SILERO_DIR}. Run its setup_env.bat, or set DURAK_SILERO_DIR.`,
  describe: (id) => `${SILERO_CAST[id].speaker}, pitch ${SILERO_CAST[id].pitch}, tempo ${SILERO_CAST[id].tempo}`,
  /** What the engine is actually given for a line, for checking stress by eye (--show). */
  show: (id, text) => ssml(text, SILERO_CAST[id].pitch),
  /** Speaks every job to its WAV file; returns the ffmpeg filter that finishes each clip. */
  speak(id, jobs) {
    const { speaker, pitch, tempo } = SILERO_CAST[id];
    const input = jobs.map((job) => ({ wav: job.wav, speaker, ssml: ssml(job.text, pitch) }));
    run(venvPython(SILERO_DIR), ['-I', join(HERE, 'silero_say.py')], input);
    return tempo === 1 ? '' : `atempo=${tempo}`;
  },
};

// ----------------------------------------------------------------------------- Piper
// Four voices, three male and one female, so characters share them and are told apart by
// pitch (1 = as recorded, lower = deeper; kept within a tenth, as a bigger shift sounds
// processed) and pace (1 = normal, higher = slower).
const PIPER_DIR = join(ROOT, 'tools', 'piper');
const PIPER_RATE = 22050;
const PIPER_CAST = {
  boris: { voice: 'ruslan', pitch: 0.94, pace: 1.08 },
  vera: { voice: 'irina', pitch: 1.0, pace: 1.0 },
  gleb: { voice: 'dmitri', pitch: 1.0, pace: 0.98 },
  lev: { voice: 'denis', pitch: 0.91, pace: 1.12 },
  tamara: { voice: 'irina', pitch: 0.93, pace: 1.06 },
  anton: { voice: 'dmitri', pitch: 1.06, pace: 0.94 },
  fyodor: { voice: 'denis', pitch: 0.96, pace: 1.04 },
  lyuba: { voice: 'irina', pitch: 1.07, pace: 0.95 },
  kostya: { voice: 'ruslan', pitch: 1.11, pace: 0.93 },
};
// Piper guesses the stress from plain text. Where it guesses wrong, the word is given with
// an accent on the stressed vowel, which it obeys.
const ACUTE = String.fromCharCode(0x301);
const PIPER_RESPELL = [
  [/(?<![а-яё])уже(?![а-яё])/gi, `$&${ACUTE}`],
  [/(?<![а-яё])ого(?![а-яё])/gi, `$&${ACUTE}`],
  [/борозды(?![а-яё])/gi, `$&${ACUTE}`],
  [/(?<=больной )головы(?![а-яё])/gi, `$&${ACUTE}`],
  [/ну-с/gi, 'нус'],
  [/…\s*$/g, '.'],
  [/…\s*/g, '. '], // left as an ellipsis, the words on either side run together
];

const piper = {
  ready: () => existsSync(venvPython(PIPER_DIR)),
  missing: 'Piper is not set up. See the setup steps at the top of scripts/voices.mjs.',
  describe: (id) => `${PIPER_CAST[id].voice}, pitch ${PIPER_CAST[id].pitch}, pace ${PIPER_CAST[id].pace}`,
  show: (_id, text) => respell(text, PIPER_RESPELL),
  speak(id, jobs) {
    const { voice, pitch, pace } = PIPER_CAST[id];
    const input = jobs.map((job) => ({ wav: job.wav, text: respell(job.text, PIPER_RESPELL) }));
    const model = join(PIPER_DIR, 'voices', `ru_RU-${voice}-medium.onnx`);
    run(venvPython(PIPER_DIR), [join(HERE, 'piper_say.py'), model, String(pace)], input);
    return `asetrate=${Math.round(PIPER_RATE * pitch)},aresample=${PIPER_RATE},atempo=${(1 / pitch).toFixed(4)}`;
  },
};

// ---------------------------------------------------------------------------- shared
const engine = { silero, piper }[engineName];
if (!engine) {
  console.error(`Unknown engine "${engineName}". Use silero or piper.`);
  process.exit(1);
}

/** The same words, spelled so that the engine says them right. */
function respell(text, rules) {
  return rules.reduce((s, [from, to]) => s.replace(from, to), text);
}

/** Runs a speech helper, handing it its jobs as JSON on standard input. */
function run(python, argv, input) {
  const result = spawnSync(python, argv, { input: JSON.stringify(input), maxBuffer: 1 << 26 });
  if (result.status !== 0) {
    console.error(`The speech engine failed:\n${result.stderr}`);
    process.exit(1);
  }
}

/** WAV file in, small mono MP3 out, with the silence at either end trimmed off. */
function encode(wav, filter, file) {
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04';
  const chain = [filter, trim, 'areverse', trim, 'areverse'].filter(Boolean).join(',');
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', chain, '-ac', '1', '-ar', '24000', '-b:a', '48k', file]);
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr}`);
}

/** Rewrites the list of clips that exist, which is how the game knows what it can play. */
function writeIndex() {
  if (!existsSync(OUT)) return;
  const index = {};
  for (const id of readdirSync(OUT, { withFileTypes: true })) {
    if (!id.isDirectory()) continue;
    for (const lang of readdirSync(join(OUT, id.name), { withFileTypes: true })) {
      if (!lang.isDirectory()) continue;
      const names = readdirSync(join(OUT, id.name, lang.name))
        .filter((f) => f.endsWith('.mp3'))
        .map((f) => f.slice(0, -4))
        .sort();
      if (names.length > 0) (index[id.name] ??= {})[lang.name] = names;
    }
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
}

if (show) {
  const seen = new Set();
  for (const character of CHARACTERS) {
    if (only && !only.includes(character.id)) continue;
    for (const text of linesFor(character.id, LANG)) {
      const marked = engine.show(character.id, text).replace(/<\/?(speak|prosody)[^>]*>/g, '');
      if (!seen.has(marked)) console.log(marked);
      seen.add(marked);
    }
  }
  process.exit(0);
}

if (!dry && !engine.ready()) {
  console.error(engine.missing);
  process.exit(1);
}

let total = 0;
const scratch = dry ? '' : mkdtempSync(join(tmpdir(), 'durak-voices-'));
for (const character of CHARACTERS) {
  if (only && !only.includes(character.id)) continue;
  const dir = join(OUT, character.id, LANG);
  const jobs = linesFor(character.id, LANG)
    .map((text) => ({ text, name: clipName(text) }))
    .filter((job) => redo || !existsSync(join(dir, `${job.name}.mp3`)))
    .map((job) => ({ ...job, wav: join(scratch, `${character.id}-${job.name}.wav`) }));
  total += jobs.length;
  console.log(`${character.id}: ${jobs.length} to record (${engineName}: ${engine.describe(character.id)})`);
  if (dry || jobs.length === 0) continue;

  const filter = engine.speak(character.id, jobs);
  mkdirSync(dir, { recursive: true });
  for (const job of jobs) encode(job.wav, filter, join(dir, `${job.name}.mp3`));
}
if (!dry) {
  rmSync(scratch, { recursive: true, force: true });
  writeIndex();
}
console.log(`${dry ? 'would record' : 'recorded'} ${total} clips`);
