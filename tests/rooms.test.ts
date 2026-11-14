import { describe, expect, it } from 'vitest';
import { OVER, legalActions } from '../src/engine/game';
import { Observation, determinize } from '../src/engine/observe';
import { mulberry32 } from '../src/engine/rng';
import { CreateRequest, Moved, Said, Seated, ServerEvent, Snapshot, Think } from '../src/net/protocol';
import { LIMITS, Tables, refused } from '../src/net/rooms';

const RULES = { transfer: true, firstBoutFive: true, nextLead: 'fool' as const, autoDiscard: true };
const table = (over: Partial<CreateRequest> = {}): CreateRequest => ({
  name: 'Host',
  bots: ['lev'],
  maxGuests: 2,
  waitAll: false,
  rules: RULES,
  ...over,
});

/** A page at the table: it keeps what it was sent. */
function page(tables: Tables, seat: Seated) {
  const events: ServerEvent[] = [];
  const stop = tables.connect(seat.id, seat.token, (e) => events.push(e));
  if (refused(stop)) throw new Error(stop.error);
  const last = <T extends ServerEvent>(...types: T['type'][]): T | undefined =>
    events.filter((e): e is T => types.includes(e.type as T['type'])).at(-1);
  return { events, stop, seat, last };
}

function setup(seed = 1, request = table()) {
  let now = 1_000_000;
  const over: unknown[] = [];
  const tables = new Tables(mulberry32(seed), () => now, LIMITS, (g) => over.push(g));
  const made = tables.create(request);
  if (refused(made)) throw new Error(made.error);
  return { tables, made, over, pass: (ms: number) => (now += ms) };
}

const OBSERVATION = [
  'rules', 'me', 'trump', 'trumpCard', 'deckCount', 'hand', 'handSizes', 'known', 'discard',
  'attacks', 'defenses', 'attacker', 'defender', 'opener', 'turn', 'phase', 'passed', 'fresh',
].sort();

describe('shared tables', () => {
  it('deals at once when the host kept a computer player', () => {
    const { tables, made } = setup();
    const host = page(tables, made);
    const snap = host.last<Snapshot>('snap')!;
    expect(snap.gameNo).toBe(1);
    expect(snap.seats.map((s) => s.kind)).toEqual(['person', 'bot']);
    expect(snap.view.hand).toHaveLength(6);
    expect(snap.view.me).toBe(0);
  });

  it('waits for every guest when asked to', () => {
    const { tables, made } = setup(1, table({ waitAll: true }));
    const host = page(tables, made);
    expect(host.last('snap', 'deal')).toBeUndefined();
    tables.join(made.id, { name: 'Ann' });
    expect(host.last('deal')).toBeUndefined();
    tables.join(made.id, { name: 'Bob' });
    const deal = host.last<Snapshot>('deal')!;
    expect(deal.seats.map((s) => (s.kind === 'person' ? s.name : s.id))).toEqual(['Host', 'Ann', 'Bob', 'lev']);
    expect(refused(tables.join(made.id, { name: 'Late' }))).toBe(true);
  });

  it('seats a guest who arrives during a game at the next deal', () => {
    const { tables, made } = setup();
    const host = page(tables, made);
    const ann = tables.join(made.id, { name: '  Ann <b> ' }) as Seated;
    const guest = page(tables, ann);
    expect(guest.last('snap', 'deal')).toBeUndefined();
    expect(guest.last<ServerEvent & { type: 'lobby' }>('lobby')!.people.map((p) => [p.name, p.seated])).toEqual([
      ['Host', true],
      ['Ann b', false],
    ]);
    expect(refused(tables.again(made.id, ann.token))).toBe(true); // mid-game it is the host's to say
    tables.again(made.id, made.token);
    const deal = guest.last<Snapshot>('deal')!;
    expect(deal.gameNo).toBe(2);
    expect(deal.seats[0]).toMatchObject({ kind: 'person', name: 'Ann b' });
    expect(host.last<Snapshot>('deal')!.seats).toHaveLength(3);
  });

  it('refuses a bad name, a bad picture and a wrong key', () => {
    const { tables, made } = setup();
    expect(tables.join(made.id, { name: ' \n ' })).toEqual({ error: 'name' });
    expect(tables.join(made.id, { name: 'Ann', avatar: 'https://example.com/a.png' })).toEqual({ error: 'avatar' });
    expect(tables.join('nowhere', { name: 'Ann' })).toEqual({ error: 'gone' });
    expect(tables.connect(made.id, 'wrong', () => {})).toEqual({ error: 'denied' });
    const ok = tables.join(made.id, { name: 'Ann', avatar: 'data:image/webp;base64,AAAA' }) as Seated;
    const key = page(tables, ok).last<ServerEvent & { type: 'lobby' }>('lobby')!.you;
    expect(tables.avatar(made.id, key)).toBe('data:image/webp;base64,AAAA');
  });

  it('turns away the eleventh table in use, and lets old ones go', () => {
    const { tables, made, pass } = setup();
    for (let i = 1; i < LIMITS.maxActive; i++) expect(refused(tables.create(table()))).toBe(false);
    expect(tables.create(table())).toEqual({ error: 'busy' });
    pass(LIMITS.activeMs + 1);
    expect(refused(tables.create(table()))).toBe(false);
    pass(LIMITS.keepMs + 1);
    tables.tick();
    expect(tables.card(made.id)).toEqual({ error: 'gone' });
    expect(tables.status().tables).toBe(0);
  });

  it('accepts only the move of whoever is to move', () => {
    const { tables, made } = setup(3, table({ bots: [] }));
    const host = page(tables, made);
    const ann = page(tables, tables.join(made.id, { name: 'Ann' }) as Seated);
    const view = host.last<Snapshot>('deal')!.view;
    const [mover, other] = view.turn === 0 ? [host, ann] : [ann, host];
    const legal = legalActions(determinize(mover.last<Snapshot>('deal', 'snap')!.view, mulberry32(1)));
    expect(tables.move(made.id, other.seat.token, { action: legal[0], moveNo: 0 })).toEqual({ error: 'denied' });
    expect(tables.move(made.id, mover.seat.token, { action: legal[0], moveNo: 7 })).toEqual({ error: 'stale' });
    expect(tables.move(made.id, mover.seat.token, { action: 499, moveNo: 0 })).toEqual({ error: 'illegal' });
    expect(tables.move(made.id, mover.seat.token, { action: legal[0], moveNo: 0 })).toEqual({ ok: true });
    expect(other.last<Moved>('move')!.seat).toBe(1);
    expect(mover.last<Moved>('move')!.seat).toBe(0);
  });

  it('plays for a computer player when the host is away, but never for a person', () => {
    const { tables, made, pass, over } = setup(5);
    const host = page(tables, made);
    const dealt = host.last<Snapshot>('deal', 'snap')!;
    host.stop();
    for (let i = 0; i < 50; i++) {
      pass(60_000);
      tables.tick();
    }
    // The computer player has had its moves; the game then waits for the host, however long.
    expect(over).toHaveLength(0);
    const now = page(tables, made).last<Snapshot>('snap')!;
    expect(now.view.turn).toBe(0);
    expect(now.moveNo).toBeLessThanOrEqual(dealt.moveNo + 2);
  });

  it('does not deal on request while it waits for all its guests', () => {
    const { tables, made } = setup(3, table({ waitAll: true, maxGuests: 2 }));
    const host = page(tables, made);
    expect(tables.again(made.id, made.token)).toEqual({ error: 'stale' });
    const first = tables.join(made.id, { name: 'One' });
    if (refused(first)) throw new Error(first.error);
    expect(tables.again(made.id, made.token)).toEqual({ error: 'stale' });
    expect(host.last<Snapshot>('deal', 'snap')).toBeUndefined();
    const second = tables.join(made.id, { name: 'Two' });
    if (refused(second)) throw new Error(second.error);
    expect(host.last<Snapshot>('deal')!.seats).toHaveLength(4);
  });

  it('gives the game to the others when someone resigns', () => {
    const { tables, made } = setup(2, table({ bots: [] }));
    const host = page(tables, made);
    const ann = page(tables, tables.join(made.id, { name: 'Ann' }) as Seated);
    tables.resign(made.id, ann.seat.token);
    const end = host.last<ServerEvent & { type: 'resigned' }>('resigned')!.ending;
    expect(end.loser).toBe(1);
    expect(end.resigned).toBe(1);
    expect(end.hands[0]).toEqual(host.last<Snapshot>('deal')!.view.hand);
    expect(tables.again(made.id, ann.seat.token)).toEqual({ ok: true });
  });

  it('closes for everyone when the host destroys it', () => {
    const { tables, made } = setup();
    const ann = page(tables, tables.join(made.id, { name: 'Ann' }) as Seated);
    tables.leave(made.id, made.token);
    expect(ann.last('closed')).toBeDefined();
    expect(tables.status().tables).toBe(0);
  });

  it('never tells a seat a card it may not see, through whole games', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { tables, made, over } = setup(seed, table({ bots: seed % 2 ? ['lev'] : ['lev', 'vera'], rules: { ...RULES, transfer: seed % 3 > 0 } }));
      const host = page(tables, made);
      const ann = page(tables, tables.join(made.id, { name: 'Ann' }) as Seated);
      tables.again(made.id, made.token); // so that Ann is dealt in
      const rng = mulberry32(seed * 7);
      const pick = (obs: Observation): number => {
        const legal = legalActions(determinize(obs, rng), [], true);
        return legal[(rng() * legal.length) | 0];
      };
      const people = [host, ann];
      const game = (): Snapshot | Moved => host.last<Snapshot | Moved>('deal', 'move')!;
      for (let guard = 0; guard < 3000 && over.length === 0; guard++) {
        const moveNo = game().moveNo;
        const mover = people.find((p) => p.last<Snapshot | Moved>('deal', 'move')!.view.turn === 0);
        if (mover) {
          const view = mover.last<Snapshot | Moved>('deal', 'move')!.view;
          expect(tables.move(made.id, mover.seat.token, { action: pick(view), moveNo })).toEqual({ ok: true });
        } else {
          const think = host.last<Think>('think')!;
          expect(think.moveNo).toBe(moveNo);
          expect(ann.last('think')).toBeUndefined(); // only the host's page thinks for them
          expect(tables.move(made.id, made.token, { action: pick(think.obs), moveNo, seat: think.seat })).toEqual({ ok: true });
        }
        // What each person now knows: their own hand, and nothing of anyone else's.
        const views = people.map((p) => p.last<Snapshot | Moved>('deal', 'move')!);
        for (const v of views) {
          expect(Object.keys(v.view).sort()).toEqual(OBSERVATION);
          if (!v.ending) expect(Object.keys(v).sort()).toEqual(['action', 'ending', 'gameNo', 'moveNo', 'seat', 'type', 'view']);
        }
        const [a, b] = views.map((v) => v.view);
        expect(a.hand.filter((c) => b.hand.includes(c))).toEqual([]);
        // Each sees the other's hand only as a number, the same number the other holds.
        const n = a.handSizes.length;
        expect(a.handSizes[1]).toBe(b.hand.length);
        expect(b.handSizes[n - 1]).toBe(a.hand.length);
      }
      expect(over).toHaveLength(1);
      const end = game();
      expect(end.view.phase).toBe(OVER);
      expect(end.ending).toBeDefined();
    }
  });

  it('passes a phrase on to the others, cleaned and cut, and not too often', () => {
    const { tables, made, pass } = setup();
    const host = page(tables, made);
    const joined = tables.join(made.id, { name: 'Guest' });
    if (refused(joined)) throw new Error(joined.error);
    const guest = page(tables, joined);

    expect(tables.say(made.id, joined.token, { text: '  <b>hello</b>\n there ' + 'x'.repeat(200) })).toEqual({ ok: true });
    const heard = host.last<Said>('said')!;
    expect(heard.name).toBe('Guest');
    expect(heard.text.startsWith('bhello/b there x')).toBe(true);
    expect(heard.text.length).toBe(140);
    expect(guest.last<Said>('said')).toBeUndefined(); // not back to whoever said it

    expect(tables.say(made.id, joined.token, { text: 'again' })).toEqual({ error: 'hush' });
    pass(2000);
    expect(tables.say(made.id, joined.token, { text: 'again' })).toEqual({ ok: true });
    pass(2000);
    expect(tables.say(made.id, joined.token, { text: '   ' })).toEqual({ error: 'illegal' });
    expect(tables.say(made.id, 'nobody', { text: 'hi' })).toEqual({ error: 'denied' });
  });

  it('tells the table who is there, who looks elsewhere and who has gone quiet', () => {
    const { tables, made, pass } = setup();
    const host = page(tables, made);
    const joined = tables.join(made.id, { name: 'Guest' });
    if (refused(joined)) throw new Error(joined.error);
    const presence = () =>
      host.last<ServerEvent & { type: 'lobby' }>('lobby')!.people.map((p) => [p.name, p.presence]);

    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'away']]); // invited, page not open yet
    const guest = page(tables, joined);
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'here']]);

    expect(tables.ping(made.id, joined.token, { focused: false })).toEqual({ ok: true });
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'unfocused']]);
    tables.ping(made.id, joined.token, { focused: true });
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'here']]);

    // The guest's line stays open but nothing more is heard: gone, once the time is up.
    pass(LIMITS.aliveMs - 1000);
    tables.ping(made.id, made.token, {});
    tables.tick();
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'here']]);
    pass(2000);
    tables.ping(made.id, made.token, {});
    tables.tick();
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'away']]);
    tables.ping(made.id, joined.token, {});
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'here']]);

    guest.stop(); // the page is closed
    expect(presence()).toEqual([['Host', 'here'], ['Guest', 'away']]);
    expect(tables.ping(made.id, 'nobody', {})).toEqual({ error: 'denied' });
  });

  it("plays by the host's settings of the game, changed for everyone from the next deal", () => {
    const { tables, made } = setup(9, table({ rules: { ...RULES, transfer: false } }));
    const host = page(tables, made);
    const joined = tables.join(made.id, { name: 'Guest' });
    if (refused(joined)) throw new Error(joined.error);
    const guest = page(tables, joined);
    expect(host.last<Snapshot>('deal', 'snap')!.view.rules.transfer).toBe(false);

    const perevodnoy = { ...RULES, transfer: true, autoDiscard: false };
    expect(tables.setRules(made.id, joined.token, { rules: perevodnoy })).toEqual({ error: 'denied' });
    expect(tables.setRules(made.id, made.token, { rules: perevodnoy })).toEqual({ ok: true });
    expect(guest.last<ServerEvent & { type: 'lobby' }>('lobby')!.rules).toEqual(perevodnoy);
    expect(host.last<Snapshot>('deal', 'snap')!.view.rules.transfer).toBe(false); // the game under way keeps its own

    expect(tables.again(made.id, made.token)).toEqual({ ok: true });
    expect(host.last<Snapshot>('deal')!.view.rules.transfer).toBe(true);
    expect(guest.last<Snapshot>('deal')!.view.rules.transfer).toBe(true);
  });
});

