import { Card } from '../engine/cards';
import { Observation } from '../engine/observe';

// What the game and the table server say to each other. A shared table is a game dealt and judged
// by the server, for the person who opened it, the people they invited and any computer players
// they kept. Each person is sent only what their own seat may see, turned so that they sit in
// seat 0, and the moves themselves do not name a seat, so they need no turning.

/** The address of the server's part of the site, under the site root. */
export const API = 'network/api/';

export interface TableRules {
  transfer: boolean;
  firstBoutFive: boolean;
  nextLead: 'winner' | 'fool';
}

/** Who sits in a seat: a person, by the key the table knows them by, or a computer player. */
export type SeatInfo =
  | { kind: 'person'; key: string; name: string; avatar: boolean }
  | { kind: 'bot'; id: string };

/** A person at the table, seated or still waiting for the next deal. */
export interface PersonInfo {
  key: string;
  name: string;
  avatar: boolean;
  host: boolean;
  here: boolean; // their page is connected
  seated: boolean; // dealt into the game being played
}

export interface Lobby {
  type: 'lobby';
  you: string; // the key of the person this was sent to
  people: PersonInfo[];
  bots: string[]; // the computer players the host kept, by character id
  maxGuests: number;
  waitAll: boolean;
  rules: TableRules;
  playing: boolean; // a game has been dealt and is not over
}

/** Why the leader of a deal leads it. */
export type LeadReason = { by: 'trump'; card: Card } | { by: 'lot' } | { by: 'winner' } | { by: 'fool' };

/** How a game ended: every hand, the fool's seat (or a draw), and who gave up, if anyone. */
export interface Ending {
  hands: Card[][];
  loser: number;
  resigned: number; // the seat that gave up, or -1
}

/** A game as it stands, for a deal and for a page that has just connected. */
export interface Snapshot {
  type: 'deal' | 'snap';
  gameNo: number;
  moveNo: number;
  seats: SeatInfo[]; // seat 0 is whoever this was sent to
  view: Observation;
  lead: LeadReason;
  ending?: Ending;
}

export interface Moved {
  type: 'move';
  gameNo: number;
  moveNo: number; // the number of this move, counted from 1
  seat: number;
  action: number;
  view: Observation; // after the move
  ending?: Ending;
}

/** Someone gave the game up. */
export interface Resigned {
  type: 'resigned';
  gameNo: number;
  ending: Ending;
}

/** Sent to the host's page only: a computer player is to move, and this is all it may see. */
export interface Think {
  type: 'think';
  gameNo: number;
  moveNo: number;
  seat: number; // the server's own number for the seat, to send back with the move
  id: string; // the character
  obs: Observation;
}

/** The table is gone: destroyed by the host, expired, or the service was stopped. */
export interface Closed {
  type: 'closed';
}

/** Someone at the table said something. It is passed on to the others and not kept. */
export interface Said {
  type: 'said';
  key: string; // who, by the key the table knows them by
  name: string;
  text: string;
}

export type ServerEvent = Lobby | Snapshot | Moved | Resigned | Think | Closed | Said;

export interface CreateRequest {
  name: string;
  avatar?: string; // a small picture as a data: address
  bots: string[];
  maxGuests: number;
  waitAll: boolean;
  rules: TableRules;
}

export interface JoinRequest {
  name: string;
  avatar?: string;
}

/** The answer to creating or joining: the table, and the key that proves who this page is. */
export interface Seated {
  id: string;
  token: string;
}

/** What anyone with the link may know about a table before joining it. */
export interface TableCard {
  host: string;
  guests: number;
  maxGuests: number;
}

export interface Status {
  on: boolean;
  tables: number;
  active: number;
  maxActive: number;
}
