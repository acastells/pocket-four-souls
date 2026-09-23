import type { OperationArguments } from "./operation-arguments";
export type Target = {
  kind:
    | "placeholder"
    | "player"
    | "monster"
    | "item"
    | "stack"
    | "hand"
    | "soul";
  id: string;
};
export type Card = {
  id: string;
  name: string;
  image: string;
  type: string;
  url: string;
  uid: string;
  tapped?: boolean;
  eternal?: boolean;
  damage?: number;
  counters?: number;
  soulValue?: number;
  original?: Card;
};
export type Player = {
  name: string;
  character: Card;
  hand: Card[];
  items: Card[];
  souls: Card[];
  curses: Card[];
  hp: number;
  maxHp: number;
  coins: number;
  attack: number;
  tapped: boolean;
  dead: boolean;
  damage: number;
  temp: Record<string, number>;
  flags: Record<string, number>;
};
export type Op = {
  op: string;
  owner: number;
  source?: Card;
  target?: Target;
  n?: number;
  key?: string;
  value?: number;
  args?: OperationArguments;
  bindN?: string;
  bindValue?: string;
  tasks?: Op[];
};
export type StackEntry = Card & {
  kind: string;
  owner: number;
  sourceCard?: Card;
  ops: Op[];
  target?: Target;
  value?: number;
  attackRoll?: boolean;
  cancelled?: boolean;
};
export type Choice = { id: string; label: string; card?: Card; tasks: Op[] };
export type Prompt = {
  id: string;
  player: number;
  title: string;
  options: Choice[];
};
export type Game = {
  rulesVersion: 3;
  startingSeat: number;
  shopSlots: number;
  monsterSlots: number;
  mode: string;
  players: Player[];
  decks: Record<string, Card[]>;
  discard: Record<string, Card[]>;
  monsters: Card[];
  covered: Record<string, Card[]>;
  shop: Card[];
  bonus: Card[];
  stack: StackEntry[];
  queue: Op[];
  prompt: Prompt | null;
  priority: number;
  passes: number;
  turn: number;
  round: number;
  timer: number;
  die: number;
  log: string[];
  started: boolean;
  winner: string | null;
  lootPlays: number;
  bonusPlays: number[];
  purchases: number;
  attacks: number;
  combat: { uid: string; owner: number } | null;
  phase: "action" | "ending" | "setup";
  serial: number;
  flags: Record<string, number>;
  forcedUid?: string;
  pool: number;
  extraTurns: number[];
  removed: Card[];
};
export type Action = {
  type: string;
  uid?: string;
  target?: Target;
  choice?: string;
  from?: string;
  to?: string;
  useCharacter?: boolean;
  ability?: number;
};
export type Rule = {
  stats: Record<string, string>;
  effects: string[];
  rewards: Record<string, number>;
  threePlus: boolean;
  subtype: string;
};
