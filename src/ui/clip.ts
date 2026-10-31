import { Character, clipUrl } from './characters';

// While a clip plays, the portrait's own picture is blank and the frames are drawn as its
// background: one element, with nothing stacked on it. The zoom into the clip's framing and back
// out draws the picture the same way. A sheet is large, so it is fetched only the first time it
// is wanted.

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const ZOOM_MS = 1000;

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
 * Plays a character's clip on their portrait: the picture zooms in to the clip's framing, the clip
 * runs forward and then back, so that it settles on the frame it started from, and the picture
 * zooms back out. `change` puts a new picture on the portrait. Returns a function that cuts all
 * this short; `done` is called once either way, and should put the portrait's own picture back.
 */
export function playClip(
  el: HTMLImageElement,
  who: Character,
  change: (src: string) => void,
  done: () => void,
): () => void {
  const { frames, columns, fps, zoom } = who.clip!;
  const rows = Math.ceil(frames / columns);
  const url = clipUrl(who);
  const length = frames / fps;
  const picture = el.getAttribute('src')!;
  let running = true;
  let shown = false;
  let zooming: Animation | null = null;

  const stop = (): void => {
    if (!running) return;
    running = false;
    zooming?.cancel();
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

  /** Moves the picture, drawn as the background, from one scale to another. */
  const zoomPicture = (from: number, to: number, then: () => void): void => {
    const size = (scale: number): string => `${scale * 100}% ${scale * 100}%`;
    el.style.backgroundImage = `url("${picture}")`;
    el.style.backgroundSize = size(to);
    el.style.backgroundPosition = `${zoom.x}% ${zoom.y}%`;
    zooming = el.animate(
      { backgroundSize: [size(from), size(to)] },
      { duration: ZOOM_MS, easing: 'ease-in-out' },
    );
    zooming.onfinish = then;
  };

  const tick = (now: number, started: number): void => {
    if (!running) return;
    const t = Math.max(0, (now - started) / 1000);
    if (t >= 2 * length) {
      change(BLANK);
      zoomPicture(zoom.scale, 1, () => {
        el.src = picture;
        stop();
      });
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
    zoomPicture(1, zoom.scale, () => {
      // The picture dissolves away over the first frames, which also covers the moment a sheet
      // this large takes to paint for the first time.
      change(BLANK);
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
      const started = performance.now();
      tick(started, started);
    });
    el.src = BLANK;
  }, stop);
  return stop;
}
