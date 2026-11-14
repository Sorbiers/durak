import { ROOT } from '../ui/root';
import { API, Seated, ServerEvent } from './protocol';

// The page's side of a shared table: asking the table server for things, listening to it, and
// making a picture small enough to send.

/** The table this page sits at, kept in the browser so that a reload comes back to the same seat. */
export interface Link extends Seated {
  host: boolean;
}

/** What this person calls themselves at a table, and their picture, kept for the next time. */
export interface Me {
  name: string;
  avatar: string; // a small picture as a data: address, or ''
}

const url = (path: string): string => `${ROOT}${API}${path}`;

export type Failure = { error: string };
export const failed = (x: unknown): x is Failure => typeof x === 'object' && x !== null && 'error' in x;

/** Asks the table server for something. A server that is not there answers `off`. */
export async function ask<T>(path: string, body?: unknown): Promise<T | Failure> {
  try {
    const res = await fetch(url(path), {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as T | Failure;
    } catch {
      return { error: 'off' };
    }
  } catch {
    return { error: 'off' };
  }
}

export const avatarUrl = (link: Seated, key: string): string => url(`tables/${link.id}/avatar/${key}`);

/** The address a guest opens to come to the table: the game itself, with the table after the #. */
export const inviteUrl = (id: string): string => `${ROOT}#t=${id}`;

/** The table named in this page's address, if it was opened from an invitation. */
export const invitedTo = (): string | null => /^#t=([A-Za-z0-9]{6,20})$/.exec(location.hash)?.[1] ?? null;

/**
 * Listens to a table. The browser reconnects by itself when the line drops; when the server
 * refuses outright, the table is asked after, and `gone` is called if it is no longer there.
 */
export function listen(
  link: Seated,
  onEvent: (e: ServerEvent) => void,
  gone: () => void,
  onLine: (up: boolean) => void = () => {},
): () => void {
  let source: EventSource | null = null;
  let retry = 0;
  let stopped = false;
  let heard = Date.now();
  const open = (): void => {
    heard = Date.now();
    source = new EventSource(url(`tables/${link.id}/events?token=${link.token}`));
    source.onopen = () => {
      heard = Date.now();
      onLine(true);
    };
    source.onmessage = (m) => {
      heard = Date.now();
      const e = JSON.parse(m.data as string) as ServerEvent;
      if (e.type !== 'beat') onEvent(e);
    };
    source.onerror = () => {
      if (!stopped) onLine(false);
      if (stopped || source?.readyState !== EventSource.CLOSED) return;
      // Closed for good: the table is gone, or the service is. Find out which.
      void ask<unknown>(`tables/${link.id}`).then((card) => {
        if (stopped) return;
        if (failed(card) && card.error === 'gone') gone();
        else retry = window.setTimeout(open, 5000);
      });
    };
  };
  open();

  // The keepalive: the server is told every few seconds that this page is still here, and whether
  // it is the one being looked at; at once when that changes. The server beats on the stream, so a
  // stream that has gone quiet has been lost without a word, and is opened again.
  const focused = (): boolean => document.visibilityState === 'visible' && document.hasFocus();
  let told: boolean | null = null;
  const ping = (): void => {
    told = focused();
    void ask(`tables/${link.id}/ping`, { token: link.token, focused: told });
  };
  const changed = (): void => {
    if (focused() !== told) ping();
  };
  const keepalive = window.setInterval(() => {
    if (source && source.readyState !== EventSource.CLOSED && Date.now() - heard > STREAM_QUIET) {
      source.close();
      onLine(false);
      open();
    }
    ping();
  }, PING_EVERY);
  const events = ['visibilitychange', 'focus', 'blur'] as const;
  for (const name of events) (name === 'visibilitychange' ? document : window).addEventListener(name, changed);
  ping();

  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(keepalive);
    for (const name of events) (name === 'visibilitychange' ? document : window).removeEventListener(name, changed);
    source?.close();
  };
}

const PING_EVERY = 10_000; // the server takes a page to be gone after 25 s without one
const STREAM_QUIET = 40_000; // the server beats every 15 s

const AVATAR_SIZE = 256;
const AVATAR_LIMIT = 70_000; // of the data: address; the server takes a little more

/** A chosen picture as a small square, cut from its middle, as a data: address. */
export async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  // WebP where the browser can write it, else JPEG; coarser until it is small enough.
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const quality of [0.8, 0.6, 0.4]) {
      const data = canvas.toDataURL(type, quality);
      if (data.startsWith(`data:${type}`) && data.length <= AVATAR_LIMIT) return data;
    }
  }
  throw new Error('picture too large');
}

/** A plain disc with a person's initial, for someone who sent no picture. */
export function initialPicture(name: string): string {
  const letter = (Array.from(name.trim())[0] ?? '?').toUpperCase().replace(/[<>&"']/g, '?');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2f6b55"/>` +
    `<text x="50" y="68" font-size="54" font-family="sans-serif" text-anchor="middle" fill="#f3ead6">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
