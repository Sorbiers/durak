import { heuristicAction } from '../ai/heuristic';
import { GameState, NO_LOSER, OVER, applyAction, cloneState, isLegal, legalActions, lowestTrump, newGame } from '../engine/game';
import { observe } from '../engine/observe';
import { Rng } from '../engine/rng';
import {
  CreateRequest,
  Ending,
  JoinRequest,
  LeadReason,
  Lobby,
  Presence,
  Seated,
  SeatInfo,
  ServerEvent,
  Snapshot,
  Status,
  TableCard,
  TableRules,
} from './protocol';

// The shared tables, as plain logic: no network and no clock of its own, so that it can be tested.
// The server deals and judges. Nobody is ever sent a card they may not see: every message about a
// game is made by `observe` for the seat it goes to.

export interface Limits {
  maxActive: number; // tables in use at once; a new one is refused beyond this
  maxTables: number; // tables kept at all, in use or not
  maxGuests: number; // invited people at one table
  maxSeats: number; // players in one game, people and computer players together
  keepMs: number; // a table goes this long after it was last used
  aliveMs: number; // a page not heard from for this long is taken to be gone, connected or not
  activeMs: number; // a table counts as in use this long after its last move
  botMs: number; // a computer player's move is awaited from the host's page this long
  botAloneMs: number; // ... and this long when the host's page is not there
}

export const LIMITS: Limits = {
  maxActive: 10,
  maxTables: 40,
  maxGuests: 3,
  maxSeats: 4,
  keepMs: 12 * 3600_000,
  aliveMs: 25_000,
  activeMs: 15 * 60_000,
  botMs: 30_000,
  botAloneMs: 3_000,
};

export type Refusal = 'busy' | 'gone' | 'full' | 'name' | 'avatar' | 'denied' | 'stale' | 'illegal' | 'hush';
export const refused = (x: unknown): x is { error: Refusal } =>
  typeof x === 'object' && x !== null && 'error' in x;
const no = (error: Refusal): { error: Refusal } => ({ error });

const NAME_LENGTH = 20;
export const SAY_LENGTH = 140; // of a phrase said to the table
const SAY_EVERY = 1500; // one person's phrases come no closer together than this, ms
const AVATAR = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_LENGTH = 80_000; // of the data: address; about 60 KB of picture
const BOT = /^[a-z]{2,20}$/;

interface Person {
  key: string;
  token: string;
  name: string;
  avatar: string | null;
  host: boolean;
  saidAt: number; // when they last said something
  seenAt: number; // when their page last connected or sent its keepalive
  focused: boolean; // their page, by its last keepalive, is the one they are looking at
  told: Presence; // their presence as the table was last told it
  sinks: Set<(e: ServerEvent) => void>; // the pages this person has open
}

interface Table {
  id: string;
  people: Person[]; // the host first, then guests as they joined
  bots: string[];
  maxGuests: number;
  waitAll: boolean;
  rules: TableRules;
  touched: number;
  gameNo: number;
  game: GameState | null;
  seats: SeatInfo[]; // of the game being played, in the server's order
  moveNo: number;
  lead: LeadReason;
  turnAt: number; // when the seat to move got the move
  firstOut: number; // the first seat to get rid of every card, or -1
  resigned: number;
  lastWinner?: string; // by key, since seats change between deals
  lastFool?: string;
}

/** A game seen from seat `by`: the same game with the seats renumbered so that `by` is seat 0. */
export function turned(s: GameState, by: number): GameState {
  const n = s.hands.length;
  const at = (p: number): number => (p < 0 ? p : (p - by + n) % n);
  let passed = 0;
  for (let p = 0; p < n; p++) if (s.passed & (1 << p)) passed |= 1 << at(p);
  return {
    ...s,
    hands: s.hands.map((_, i) => s.hands[(i + by) % n]),
    attacker: at(s.attacker),
    defender: at(s.defender),
    opener: at(s.opener),
    turn: at(s.turn),
    passed,
    loser: at(s.loser),
  };
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function word(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function clean(raw: unknown, length: number): string {
  return typeof raw === 'string'
    ? raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, length)
    : '';
}
const cleanName = (raw: unknown): string => clean(raw, NAME_LENGTH);

function cleanRules(raw: unknown): TableRules {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof TableRules, unknown>>;
  return {
    transfer: r.transfer === true,
    firstBoutFive: r.firstBoutFive !== false,
    nextLead: r.nextLead === 'winner' ? 'winner' : 'fool',
    autoDiscard: r.autoDiscard !== false,
  };
}

export class Tables {
  private tables = new Map<string, Table>();

  constructor(
    private rng: Rng,
    private now: () => number = Date.now,
    private limits: Limits = LIMITS,
    /** Called when a game ends, for the count of games: no names, only who sat where. */
    private onOver: (game: { people: number; bots: string[]; moves: number; resigned: boolean }) => void = () => {},
  ) {}

  status(): Status {
    return { on: true, tables: this.tables.size, active: this.active(), maxActive: this.limits.maxActive };
  }

  private active(): number {
    const since = this.now() - this.limits.activeMs;
    let n = 0;
    for (const t of this.tables.values()) if (t.touched >= since) n++;
    return n;
  }

  private person(raw: { name: unknown; avatar?: unknown }, host: boolean): Person | { error: Refusal } {
    const name = cleanName(raw.name);
    if (!name) return no('name');
    let avatar: string | null = null;
    if (raw.avatar !== undefined && raw.avatar !== null && raw.avatar !== '') {
      if (typeof raw.avatar !== 'string' || raw.avatar.length > AVATAR_LENGTH || !AVATAR.test(raw.avatar)) return no('avatar');
      avatar = raw.avatar;
    }
    return {
      key: word(8), token: word(24), name, avatar, host, saidAt: -Infinity,
      seenAt: this.now(), focused: true, told: 'away', sinks: new Set(),
    };
  }

  create(req: CreateRequest): Seated | { error: Refusal } {
    if (this.active() >= this.limits.maxActive) return no('busy');
    if (this.tables.size >= this.limits.maxTables) {
      // Room is made by letting go of the table that has been out of use the longest.
      const idle = [...this.tables.values()].sort((a, b) => a.touched - b.touched)[0]!;
      this.close(idle);
    }
    const host = this.person(req, true);
    if (refused(host)) return host;
    const maxGuests = Math.min(this.limits.maxGuests, Math.max(1, Math.floor(Number(req.maxGuests)) || 1));
    const bots = (Array.isArray(req.bots) ? req.bots : [])
      .filter((id): id is string => typeof id === 'string' && BOT.test(id))
      .slice(0, this.limits.maxSeats - 1);
    const table: Table = {
      id: word(10),
      people: [host],
      bots: [...new Set(bots)],
      maxGuests,
      waitAll: req.waitAll === true,
      rules: cleanRules(req.rules),
      touched: this.now(),
      gameNo: 0,
      game: null,
      seats: [],
      moveNo: 0,
      lead: { by: 'lot' },
      turnAt: 0,
      firstOut: -1,
      resigned: -1,
      lastWinner: undefined,
      lastFool: undefined,
    };
    this.tables.set(table.id, table);
    this.firstDeal(table);
    return { id: table.id, token: host.token };
  }

  card(id: string): TableCard | { error: Refusal } {
    const t = this.tables.get(id);
    if (!t) return no('gone');
    return { host: t.people[0]!.name, guests: t.people.length - 1, maxGuests: t.maxGuests };
  }

  join(id: string, req: JoinRequest): Seated | { error: Refusal } {
    const t = this.tables.get(id);
    if (!t) return no('gone');
    if (t.people.length - 1 >= t.maxGuests) return no('full');
    const guest = this.person(req, false);
    if (refused(guest)) return guest;
    t.people.push(guest);
    t.touched = this.now();
    this.firstDeal(t);
    this.tellLobby(t);
    return { id, token: guest.token };
  }

  /** A page starts listening. Returns what to call when it stops. */
  connect(id: string, token: string, sink: (e: ServerEvent) => void): (() => void) | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    who.sinks.add(sink);
    who.seenAt = this.now();
    this.tellLobby(t);
    const seat = this.seatOf(t, who);
    if (t.game && seat >= 0) {
      sink(this.snapshot(t, seat, 'snap'));
      this.askHost(t, sink);
    }
    return () => {
      who.sinks.delete(sink);
      if (this.tables.get(id) === t) this.tellLobby(t);
    };
  }

  /** A page's keepalive, every few seconds and whenever it gains or loses the person's attention.
   *  It does not count as using the table, so an open page alone does not keep one for ever. */
  ping(id: string, token: string, req: { focused?: unknown }): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    who.seenAt = this.now();
    who.focused = req.focused !== false;
    if (this.presence(who) !== who.told) this.tellLobby(t);
    return { ok: true };
  }

  avatar(id: string, key: string): string | null {
    return this.tables.get(id)?.people.find((p) => p.key === key)?.avatar ?? null;
  }

  /** A move: a person's own, or from the host's page for a computer player (`seat` given). */
  move(id: string, token: string, req: { action: unknown; moveNo: unknown; seat?: unknown }): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    const g = t.game;
    if (!g || g.phase === OVER || req.moveNo !== t.moveNo) return no('stale');
    let seat = this.seatOf(t, who);
    if (req.seat !== undefined) {
      if (!who.host || t.seats[g.turn]?.kind !== 'bot' || req.seat !== g.turn) return no('denied');
      seat = g.turn;
    }
    if (seat !== g.turn) return no('denied');
    if (typeof req.action !== 'number' || !isLegal(g, req.action)) return no('illegal');
    this.apply(t, req.action);
    return { ok: true };
  }

  resign(id: string, token: string): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    const seat = this.seatOf(t, who);
    if (!t.game || t.game.phase === OVER || seat < 0) return no('stale');
    t.game = { ...cloneState(t.game), phase: OVER, loser: seat };
    t.resigned = seat;
    t.touched = this.now();
    this.ended(t);
    this.seated(t, (p, s) => this.send(p, { type: 'resigned', gameNo: t.gameNo, ending: this.ending(t, s)! }));
    this.tellLobby(t);
    return { ok: true };
  }

  /** The next deal: anyone at the table once a game is over, the host at any time. */
  again(id: string, token: string): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    if (t.game && t.game.phase !== OVER && !who.host) return no('denied');
    // Asking does not hurry a table that is still waiting for its guests.
    if (t.gameNo === 0 && !this.ready(t)) return no('stale');
    if (!this.deal(t)) return no('stale');
    return { ok: true };
  }

  /** The host changes the settings of the game: they hold for everyone, from the next deal. */
  setRules(id: string, token: string, req: { rules?: unknown }): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    if (!who.host) return no('denied');
    t.rules = cleanRules(req.rules);
    this.tellLobby(t);
    return { ok: true };
  }

  /** A phrase said to the table: passed on to everyone else there, seated or waiting, and not kept. */
  say(id: string, token: string, req: { text?: unknown }): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    const text = clean(req.text, SAY_LENGTH);
    if (!text) return no('illegal');
    if (this.now() - who.saidAt < SAY_EVERY) return no('hush');
    who.saidAt = this.now();
    for (const p of t.people) if (p !== who) this.send(p, { type: 'said', key: who.key, name: who.name, text });
    return { ok: true };
  }

  /** A guest leaves; the host leaving takes the table with them. */
  leave(id: string, token: string): { ok: true } | { error: Refusal } {
    const found = this.find(id, token);
    if (refused(found)) return found;
    const { t, who } = found;
    if (who.host) {
      this.close(t);
      return { ok: true };
    }
    this.send(who, { type: 'closed' });
    t.people = t.people.filter((p) => p !== who);
    this.tellLobby(t);
    return { ok: true };
  }

  /** Closes every table, when the service stops. */
  closeAll(): void {
    for (const t of [...this.tables.values()]) this.close(t);
  }

  /** To be called every second or so: lets go of old tables and plays for whoever is not there. */
  tick(): void {
    const now = this.now();
    for (const t of [...this.tables.values()]) {
      if (now - t.touched > this.limits.keepMs) {
        this.close(t);
        continue;
      }
      // A page gone quiet without closing its line (a lost network, a computer asleep) shows as gone.
      if (t.people.some((p) => this.presence(p) !== p.told)) this.tellLobby(t);
      const g = t.game;
      if (!g || g.phase === OVER) continue;
      const seat = t.seats[g.turn]!;
      const waited = now - t.turnAt;
      // A person is never moved for, however long they take or wherever their page has gone: the
      // table waits, and the host can deal again. Only a seat whose person has left the table
      // for good is played out, like a computer player whose host is away.
      let limit: number;
      if (seat.kind === 'bot') {
        limit = this.presence(t.people[0]!) !== 'away' ? this.limits.botMs : this.limits.botAloneMs;
      } else if (t.people.some((p) => p.key === seat.key)) continue;
      else limit = this.limits.botAloneMs;
      if (waited >= limit) this.apply(t, heuristicAction(g, legalActions(g), this.rng));
    }
  }

  // ----------------------------------------------------------------- inside

  private find(id: string, token: string): { t: Table; who: Person } | { error: Refusal } {
    const t = this.tables.get(id);
    if (!t) return no('gone');
    const who = t.people.find((p) => p.token === token);
    return who ? { t, who } : no('denied');
  }

  private seatOf(t: Table, who: Person): number {
    return t.seats.findIndex((s) => s.kind === 'person' && s.key === who.key);
  }

  private close(t: Table): void {
    this.tables.delete(t.id);
    for (const p of t.people) this.send(p, { type: 'closed' });
  }

  private send(p: Person, e: ServerEvent): void {
    for (const sink of p.sinks) sink(e);
  }

  /** Calls `fn` for each person dealt into the game, with their seat. */
  private seated(t: Table, fn: (p: Person, seat: number) => void): void {
    for (const p of t.people) {
      const seat = this.seatOf(t, p);
      if (seat >= 0) fn(p, seat);
    }
  }

  private presence(p: Person): Presence {
    if (p.sinks.size === 0 || this.now() - p.seenAt > this.limits.aliveMs) return 'away';
    return p.focused ? 'here' : 'unfocused';
  }

  private tellLobby(t: Table): void {
    const playing = t.game !== null && t.game.phase !== OVER;
    for (const p of t.people) p.told = this.presence(p);
    for (const p of t.people) {
      const lobby: Lobby = {
        type: 'lobby',
        you: p.key,
        people: t.people.map((q) => ({
          key: q.key,
          name: q.name,
          avatar: q.avatar !== null,
          host: q.host,
          presence: q.told,
          seated: this.seatOf(t, q) >= 0,
        })),
        bots: t.bots,
        maxGuests: t.maxGuests,
        waitAll: t.waitAll,
        rules: t.rules,
        playing,
      };
      this.send(p, lobby);
    }
  }

  /** The first game is dealt by itself, as soon as there is anyone to play it with. */
  /** Whether the first game may be dealt: at once, or once every guest has come if the host asked to wait. */
  private ready(t: Table): boolean {
    return !t.waitAll || t.people.length - 1 >= t.maxGuests;
  }

  private firstDeal(t: Table): void {
    if (t.gameNo === 0 && this.ready(t)) this.deal(t);
  }

  private deal(t: Table): boolean {
    const seats: SeatInfo[] = [
      ...t.people.map((p): SeatInfo => ({ kind: 'person', key: p.key, name: p.name, avatar: p.avatar !== null })),
      ...t.bots.map((id): SeatInfo => ({ kind: 'bot', id })),
    ].slice(0, this.limits.maxSeats);
    const n = seats.length;
    if (n < 2) return false;
    const keyOf = (s: SeatInfo): string => (s.kind === 'person' ? s.key : `bot:${s.id}`);
    const seatBy = (key: string | undefined): number => seats.findIndex((s) => keyOf(s) === key);
    // The lead goes by the table's custom: to the previous winner, or to the player on the fool's
    // right, who leads at the fool. Failing either, the lowest trump.
    const byWinner = t.rules.nextLead === 'winner';
    const fool = seatBy(t.lastFool);
    const earned = byWinner ? seatBy(t.lastWinner) : fool < 0 ? -1 : (fool - 1 + n) % n;
    const game = newGame(
      { players: n, transfer: t.rules.transfer, firstBoutFive: t.rules.firstBoutFive },
      this.rng,
      earned >= 0 ? earned : undefined,
    );
    const shown = earned >= 0 ? null : lowestTrump(game.hands, game.trump);
    t.lead = earned >= 0 ? { by: byWinner ? 'winner' : 'fool' } : shown ? { by: 'trump', card: shown.card } : { by: 'lot' };
    t.game = game;
    t.seats = seats;
    t.gameNo++;
    t.moveNo = 0;
    t.firstOut = -1;
    t.resigned = -1;
    t.turnAt = t.touched = this.now();
    this.seated(t, (p, s) => this.send(p, this.snapshot(t, s, 'deal')));
    this.tellLobby(t);
    this.askHost(t);
    return true;
  }

  private snapshot(t: Table, seat: number, type: 'deal' | 'snap'): Snapshot {
    const n = t.seats.length;
    return {
      type,
      gameNo: t.gameNo,
      moveNo: t.moveNo,
      seats: t.seats.map((_, i) => t.seats[(i + seat) % n]!),
      view: observe(turned(t.game!, seat), 0),
      lead: t.lead,
      ending: this.ending(t, seat),
    };
  }

  private ending(t: Table, seat: number): Ending | undefined {
    const g = t.game!;
    if (g.phase !== OVER) return undefined;
    const n = g.hands.length;
    const seen = turned(g, seat);
    return { hands: seen.hands.map((h) => h.slice()), loser: seen.loser, resigned: t.resigned < 0 ? -1 : (t.resigned - seat + n) % n };
  }

  /** When a computer player is to move, the host's page is asked to think for it. */
  private askHost(t: Table, only?: (e: ServerEvent) => void): void {
    const g = t.game;
    if (!g || g.phase === OVER) return;
    const seat = t.seats[g.turn]!;
    if (seat.kind !== 'bot') return;
    const e: ServerEvent = { type: 'think', gameNo: t.gameNo, moveNo: t.moveNo, seat: g.turn, id: seat.id, obs: observe(g, g.turn) };
    const host = t.people[0]!;
    if (only) {
      if (host.sinks.has(only)) only(e);
    } else this.send(host, e);
  }

  private apply(t: Table, action: number): void {
    const g = t.game!;
    const seat = g.turn;
    applyAction(g, action);
    t.moveNo++;
    t.turnAt = t.touched = this.now();
    if (t.firstOut < 0) {
      // Hands empty one move at a time, so this is whoever just played their last card.
      const out = (p: number): boolean => g.hands[p].length === 0 && g.deck.length === 0;
      t.firstOut = [seat, ...g.hands.keys()].find(out) ?? -1;
    }
    if (g.phase === OVER) this.ended(t);
    const n = g.hands.length;
    this.seated(t, (p, s) =>
      this.send(p, {
        type: 'move',
        gameNo: t.gameNo,
        moveNo: t.moveNo,
        seat: (seat - s + n) % n,
        action,
        view: observe(turned(g, s), 0),
        ending: this.ending(t, s),
      }),
    );
    if (g.phase === OVER) this.tellLobby(t);
    else this.askHost(t);
  }

  private ended(t: Table): void {
    const g = t.game!;
    const keyOf = (seat: number): string | undefined => {
      const s = t.seats[seat];
      return !s ? undefined : s.kind === 'person' ? s.key : `bot:${s.id}`;
    };
    // The winner leads the next game. After a resignation with nobody out yet, the only possible
    // winner is the other player of a two-player game.
    const winner = t.firstOut >= 0 ? t.firstOut : t.resigned >= 0 && g.hands.length === 2 ? 1 - t.resigned : -1;
    t.lastWinner = keyOf(winner);
    t.lastFool = g.loser >= 0 ? keyOf(g.loser) : undefined;
    if (g.loser === NO_LOSER) return;
    this.onOver({
      people: t.seats.filter((s) => s.kind === 'person').length,
      bots: t.seats.flatMap((s) => (s.kind === 'bot' ? [s.id] : [])),
      moves: t.moveNo,
      resigned: t.resigned >= 0,
    });
  }
}
