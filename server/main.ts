import { appendFile } from 'node:fs/promises';
import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { cryptoRng } from '../src/engine/rng';
import { LIMITS, Refusal, Tables, refused } from '../src/net/rooms';

// The table server: a small process behind nginx, which passes it everything under /network/api/.
// It keeps the shared tables in memory, deals and judges their games, and tells each page what its
// seat may see. Nothing is written down but one line per finished game, for the count of games.
//
// Settings come from the environment (network.env): NETWORK_PORT, NETWORK_MAX_GAMES,
// NETWORK_MAX_GUESTS, NETWORK_KEEP_HOURS, NETWORK_STATS (the file the count is kept in).

const PREFIX = '/network/api/';
const PORT = Number(process.env.NETWORK_PORT) || 8083;
const BODY_LIMIT = 120_000; // a picture is the only large thing ever sent
const STATS = process.env.NETWORK_STATS;

const number = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const tables = new Tables(
  cryptoRng,
  Date.now,
  {
    ...LIMITS,
    maxActive: number('NETWORK_MAX_GAMES', LIMITS.maxActive),
    maxGuests: Math.min(3, number('NETWORK_MAX_GUESTS', LIMITS.maxGuests)),
    keepMs: number('NETWORK_KEEP_HOURS', 12) * 3600_000,
  },
  (game) => {
    if (!STATS) return;
    const line = [new Date().toISOString(), game.people, game.bots.join('+') || '-', game.moves, game.resigned ? 'resigned' : 'played'];
    void appendFile(STATS, line.join(' ') + '\n').catch(() => undefined);
  },
);
setInterval(() => tables.tick(), 1000);

const STATUS: Record<Refusal, number> = {
  busy: 503,
  gone: 404,
  full: 409,
  stale: 409,
  denied: 403,
  name: 400,
  avatar: 400,
  illegal: 400,
  hush: 429,
};

function reply(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(text);
}

const answer = (res: ServerResponse, result: unknown): void =>
  refused(result) ? reply(res, STATUS[result.error], result) : reply(res, 200, result);

function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (part: Buffer) => {
      size += part.length;
      if (size > BODY_LIMIT) {
        reject(new Error('too large'));
        req.destroy();
      } else parts.push(part);
    });
    req.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
        resolve(typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {});
      } catch (e) {
        reject(e as Error);
      }
    });
    req.on('error', reject);
  });
}

const streams = new Set<ServerResponse>();

/** A page listening to its table: server-sent events, one JSON message each. */
function listen(res: ServerResponse, id: string, token: string): void {
  let open = false;
  const stop = tables.connect(id, token, (e) => {
    if (!open) queueMicrotask(() => res.write(`data: ${JSON.stringify(e)}\n\n`));
    else res.write(`data: ${JSON.stringify(e)}\n\n`);
  });
  if (refused(stop)) return reply(res, STATUS[stop.error], stop);
  // nginx is told not to hold the stream back, and a comment now and then keeps it open.
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  res.write(': hello\n\n');
  open = true;
  streams.add(res);
  // A beat the page can see, unlike a comment: a page that hears nothing for a while reconnects.
  const beat = setInterval(() => res.write('data: {"type":"beat"}\n\n'), 15_000);
  res.on('close', () => {
    clearInterval(beat);
    streams.delete(res);
    stop();
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(PREFIX)) return reply(res, 404, { error: 'gone' });
  const [first, id = '', what = '', key = ''] = url.pathname.slice(PREFIX.length).split('/');
  const get = req.method === 'GET';
  const post = req.method === 'POST';

  if (first === 'status' && get) return reply(res, 200, tables.status());
  if (first !== 'tables') return reply(res, 404, { error: 'gone' });
  if (!id) {
    if (!post) return reply(res, 405, { error: 'denied' });
    return answer(res, tables.create((await body(req)) as never));
  }
  if (get && what === '') return answer(res, tables.card(id));
  if (get && what === 'events') return listen(res, id, url.searchParams.get('token') ?? '');
  if (get && what === 'avatar') {
    const picture = tables.avatar(id, key);
    const m = picture?.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!m) return reply(res, 404, { error: 'gone' });
    res.writeHead(200, { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.end(Buffer.from(m[2], 'base64'));
    return;
  }
  if (!post) return reply(res, 405, { error: 'denied' });
  const sent = await body(req);
  const token = typeof sent.token === 'string' ? sent.token : '';
  switch (what) {
    case 'join':
      return answer(res, tables.join(id, sent as never));
    case 'move':
      return answer(res, tables.move(id, token, sent as never));
    case 'resign':
      return answer(res, tables.resign(id, token));
    case 'again':
      return answer(res, tables.again(id, token));
    case 'ping':
      return answer(res, tables.ping(id, token, sent as never));
    case 'rules':
      return answer(res, tables.setRules(id, token, sent as never));
    case 'say':
      return answer(res, tables.say(id, token, sent as never));
    case 'leave':
      return answer(res, tables.leave(id, token));
    default:
      return reply(res, 404, { error: 'gone' });
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) reply(res, 400, { error: 'illegal' });
    else res.end();
  });
});

// Only nginx on this machine talks to it.
server.listen(PORT, '127.0.0.1', () => console.log(`tables on 127.0.0.1:${PORT}`));

function stop(): void {
  // Every page is told its table is gone before the process goes, so nobody is left at a frozen one.
  tables.closeAll();
  setTimeout(() => {
    for (const res of streams) res.end();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500);
  }, 100);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
