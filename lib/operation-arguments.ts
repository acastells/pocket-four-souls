import type { Card, Choice, Op, StackEntry, Target } from "./game-types";
/** Parameters used by the internal effect interpreter. Never accepted from HTTP. */
export interface OperationArguments {
  ability?: number;
  attack?: boolean;
  attackRoll?: boolean;
  bind?: string;
  bottom?: boolean | Card[];
  cancel?: boolean;
  card?: Card;
  cards?: Card[];
  combat?: boolean;
  copy?: boolean;
  covered?: Card[];
  damage?: Op;
  deck?: string;
  discard?: Card[];
  duke?: boolean;
  effectCard?: Card;
  entry?: StackEntry;
  exclude?: string;
  finish?: Op[];
  index?: number;
  kind?: string;
  mode?: string;
  monsters?: boolean;
  n?: number;
  optional?: boolean;
  options?: Pick<Choice, "label" | "tasks" | "card">[];
  ordered?: Card[];
  other?: Target;
  others?: boolean;
  player?: number | Target;
  prevention?: boolean;
  query?: string;
  repeat?: boolean;
  rest?: Card[];
  savesDone?: boolean;
  source?: Card;
  tasks?: Op[];
  temporary?: boolean;
  title?: string;
  top?: Card[];
  uid?: string;
  value?: number;
  votes?: string[];
}
export function operationArguments(operation: Op) {
  const args = operation.args;
  return {
    title: "Elige",
    query: "",
    kind: "effect",
    options: [],
    tasks: [],
    index: 0,
    deck: "",
    ...args,
  };
}
export const targetSlot = (name: string): Target => ({
  kind: "placeholder",
  id: name,
});

/** Substitutes only the selected scope; nested selections keep their own binding. */
export function bindOperations(
  operations: Op[],
  name: string,
  value: Target | number,
): Op[] {
  function replace(input: unknown): unknown {
    if (input === name) return value;
    if (Array.isArray(input)) return input.map(replace);
    if (typeof input !== "object" || input === null) return input;
    const record = input as Record<string, unknown>;
    if (record.kind === "placeholder" && record.id === name) return value;
    const args = record.args as OperationArguments | undefined;
    const output = Object.fromEntries(
      Object.entries(record).map(([key, item]) => [
        key,
        key === "tasks" &&
        record.op === "select" &&
        (args?.bind || "$target") === name
          ? item
          : replace(item),
      ]),
    );
    if (record.bindN === name && typeof value === "number") {
      output.n = value;
      delete output.bindN;
    }
    if (record.bindValue === name && typeof value === "number") {
      output.value = value;
      delete output.bindValue;
    }
    return output;
  }
  // Substitution preserves operation structure; only declared binding slots change.
  return replace(operations) as Op[];
}

export const playerIndex = (
  value: number | Target | undefined,
  fallback: number,
) => (typeof value === "object" ? Number(value.id) : (value ?? fallback));
