import { Character } from './characters';
import { Lang } from './i18n';
import { clipName } from './phrases';
import { ROOT } from './root';

// Speech follows three rules. Nothing is fetched unless speech is switched on. A clip is
// played only if it has already arrived. And voices never overlap or queue: while one remark
// is being spoken, any other goes unspoken instead of being played late.

// Voices are matched to a character by the names operating systems give them.
const FEMALE = /irina|svetlana|dari|milena|katya|al[yo]ona|alena|zira|hazel|susan|samantha|victoria|karen|moira|tessa|aria|jenny|michelle|female|женск/i;
const MALE = /pavel|dmitr|maxim|yuri|david|mark|george|guy|daniel|fred|james|ryan|\bmale|мужск/i;

// Neural voices (Edge calls them "Natural" or "Online") pronounce far better than the older
// built-in ones, and Google's sit in between, so a better voice wins over a matching gender.
const quality = (v: SpeechSynthesisVoice): number =>
  /natural|neural|online/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : v.localService ? 0 : 1;

const canSynthesize = (): boolean => 'speechSynthesis' in window;
const clipUrl = (key: string): string => `${ROOT}voices/${key}.mp3`;

// Recorded clips, made ahead of time by scripts/voices.mjs. `index` says which exist; it is
// 'absent' if none were published, and null until it has been asked for.
let index: Record<string, Record<string, Set<string>>> | 'absent' | null = null;
let indexRequest: Promise<void> | null = null;
const clips = new Map<string, ArrayBuffer>(); // "boris/ru/1a2b3c4d" -> the MP3 as it arrived
const requested = new Set<string>(); // "boris/ru": sets fetched or on their way
let context: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let busy = false; // a clip is being decoded or played
let turn = 0; // bumped whenever speech is cut off, so a clip still decoding does not start

function loadIndex(): Promise<void> {
  indexRequest ??= (async () => {
    try {
      const response = await fetch(`${ROOT}voices/index.json`);
      const listed = (await response.json()) as Record<string, Record<string, string[]>>;
      const built: Record<string, Record<string, Set<string>>> = {};
      for (const [id, byLang] of Object.entries(listed)) {
        built[id] = {};
        for (const [lang, names] of Object.entries(byLang)) built[id][lang] = new Set(names);
      }
      index = built;
    } catch {
      index = 'absent'; // no clips published: the browser's voice reads everything
    }
  })();
  return indexRequest;
}

const hasClip = (id: string, lang: string, name: string): boolean =>
  index !== null && index !== 'absent' && (index[id]?.[lang]?.has(name) ?? false);

async function fetchClip(key: string): Promise<ArrayBuffer | undefined> {
  try {
    const response = await fetch(clipUrl(key));
    if (!response.ok) return undefined;
    const data = await response.arrayBuffer();
    clips.set(key, data);
    return data;
  } catch {
    return undefined;
  }
}

/**
 * Fetches every clip these characters have in this language, a few at a time, so that each
 * is on hand the moment it is wanted. Call only while speech is switched on.
 */
export function prepareVoices(cast: Character[], lang: Lang): void {
  if (canSynthesize()) window.speechSynthesis.getVoices(); // some browsers load these lazily
  void loadIndex().then(() => {
    if (index === null || index === 'absent') return;
    for (const who of cast) {
      const set = `${who.id}/${lang}`;
      if (requested.has(set)) continue;
      requested.add(set);
      const names = [...(index[who.id]?.[lang] ?? [])];
      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < names.length && requested.has(set)) await fetchClip(`${set}/${names[next++]}`);
      };
      for (let i = 0; i < 6; i++) void worker();
    }
  });
}

/** Speech was switched off: stop talking and let go of what was fetched. */
export function releaseVoices(): void {
  stopSpeaking();
  clips.clear();
  requested.clear();
}

/** Browsers keep audio locked until the page is clicked; this opens it on a click. */
function unlock(): void {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
}

async function play(data: ArrayBuffer, wait = false): Promise<void> {
  busy = true;
  const mine = ++turn;
  try {
    unlock();
    // A sample someone asked for may wait for the audio to open; a remark in the game may not.
    if (wait && context!.state === 'suspended') await context!.resume();
    // decodeAudioData empties the buffer it is given, so it gets a copy.
    const buffer = await context!.decodeAudioData(data.slice(0));
    if (mine !== turn || context!.state !== 'running') throw new Error('too late');
    const source = context!.createBufferSource();
    source.buffer = buffer;
    source.connect(context!.destination);
    source.onended = () => {
      if (playing === source) {
        playing = null;
        busy = false;
      }
    };
    playing = source;
    source.start();
  } catch {
    if (mine === turn) busy = false;
  }
}

const speaking = (): boolean =>
  busy || (canSynthesize() && (window.speechSynthesis.speaking || window.speechSynthesis.pending));

/**
 * Says a remark in a character's voice: their recorded clip if one exists, else the
 * browser's voice. If something is still being said, or the clip has not arrived yet, the
 * remark is left unspoken.
 */
export function speak(text: string, who: Character, lang: Lang): void {
  if (!text || speaking() || index === null) return;
  const name = clipName(text);
  const data = clips.get(`${who.id}/${lang}/${name}`);
  if (data) void play(data);
  else if (!hasClip(who.id, lang, name)) synthesize(text, who, lang);
}

/**
 * Plays a sample at the listener's request, fetching it first if need be. Unlike a remark in
 * the game this may start a moment late, since someone is waiting for it.
 */
export async function audition(text: string, who: Character, lang: Lang): Promise<void> {
  stopSpeaking();
  const mine = turn;
  unlock();
  await loadIndex();
  const name = clipName(text);
  const key = `${who.id}/${lang}/${name}`;
  const data = clips.get(key) ?? (hasClip(who.id, lang, name) ? await fetchClip(key) : undefined);
  if (mine !== turn) return; // something else was asked for meanwhile
  if (data) await play(data, true);
  else synthesize(text, who, lang);
}

/**
 * Reads a line aloud with the browser's built-in voices. This costs nothing and needs no
 * files, but the voices are whatever the device has, so characters differ mainly in pitch.
 */
function synthesize(text: string, who: Character, lang: Lang): void {
  if (!canSynthesize()) return;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = { ru: 'ru-RU', en: 'en-US', fr: 'fr-FR' }[lang];
  const fits = (v: SpeechSynthesisVoice): boolean =>
    who.female ? FEMALE.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name);
  const score = (v: SpeechSynthesisVoice): number => quality(v) * 2 + (fits(v) ? 1 : 0);
  const voice = synth
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang))
    .sort((a, b) => score(b) - score(a))[0];
  if (voice) utterance.voice = voice;
  utterance.pitch = who.pitch;
  utterance.rate = 1;
  synth.speak(utterance);
}

/** Cuts off whatever is being said. */
export function stopSpeaking(): void {
  turn++;
  if (playing) {
    playing.onended = null;
    playing.stop();
    playing = null;
  }
  busy = false;
  if (canSynthesize()) window.speechSynthesis.cancel();
}

// The first click anywhere opens the audio, but only once speech has been asked for.
document.addEventListener('pointerdown', () => {
  if (index !== null) unlock();
});
