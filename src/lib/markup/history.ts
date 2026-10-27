import type { MarkupItem } from "./doc";

/*
 * Undo and redo for the viewer. Each entry is the whole list of marks; marks
 * are never changed in place, so entries share them and stay cheap.
 */

export const HISTORY_LIMIT = 100;

export type History = {
  past: MarkupItem[][];
  present: MarkupItem[];
  future: MarkupItem[][];
};

export function startHistory(items: MarkupItem[]): History {
  return { past: [], present: items, future: [] };
}

/** A new step that undo goes back from. */
export function pushHistory(history: History, next: MarkupItem[]): History {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

/** Changes the latest step in place: an eraser drag is one step however much it rubs out. */
export function amendHistory(history: History, next: MarkupItem[]): History {
  return next === history.present ? history : { ...history, present: next, future: [] };
}

export function undoHistory(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}
