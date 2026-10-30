import { Character, clipUrl } from './characters';

// While a clip plays, the portrait's own picture is blank and the frames are drawn as its
// background: one element, with nothing stacked on it. A sheet is large, so it is fetched only
// the first time it is wanted.

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const sheets = new Map<string, Promise<void>>();

function loadSheet(url: string): Promise<void> {
  let sheet = sheets.get(url);
  if (!sheet) {
    const image = new Image();
    image.src = url;
    // decode() rather than onload: arrived is not yet ready to paint, and the first frames
    // would show blank.
    sheet = image.decode();
    sheet.catch(() => sheets.delete(url)); // the next time it is wanted, it is tried again
    sheets.set(url, sheet);
  }
  return sheet;
}

/**
 * Plays a character's clip on their portrait, forward and then back, so that it settles on the
 * frame it started from. Returns a function that cuts it short; `done` is called once either
 * way, and should put the portrait's own picture back.
 */
export function playClip(el: HTMLImageElement, who: Character, done: () => void): () => void {
  const { frames, columns, fps } = who.clip!;
  const rows = Math.ceil(frames / columns);
  const url = clipUrl(who);
  const length = frames / fps;
  let running = true;
  let shown = false;

  const stop = (): void => {
    if (!running) return;
    running = false;
    // The frame stays under the picture until the picture is there, so nothing blank shows.
    if (shown) {
      el.addEventListener(
        'load',
        () => {
          if (el.getAttribute('src') !== BLANK) el.style.backgroundImage = '';
        },
        { once: true },
      );
    }
    done();
  };

  const tick = (now: number, started: number): void => {
    if (!running) return;
    const t = Math.max(0, (now - started) / 1000);
    if (t >= 2 * length) {
      stop();
      return;
    }
    const frame = Math.min(frames - 1, Math.floor((t < length ? t : 2 * length - t) * fps));
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    el.style.backgroundPosition = `${(column / (columns - 1)) * 100}% ${(row / (rows - 1)) * 100}%`;
    requestAnimationFrame((next) => tick(next, started));
  };

  loadSheet(url).then(() => {
    if (!running) return;
    shown = true;
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
    const started = performance.now();
    tick(started, started);
    el.src = BLANK;
  }, stop);
  return stop;
}
