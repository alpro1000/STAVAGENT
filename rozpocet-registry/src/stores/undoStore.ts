/**
 * Undo/Redo Store (Zustand)
 * In-memory only — resets on page reload.
 * Max 50 entries in undo stack.
 */

import { create } from 'zustand';

const MAX_UNDO = 50;

export interface UndoChange {
  itemId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface UndoEntry {
  action: string;       // "set_skupina" | "clear_skupina" | "bulk_skupina" | "ai_classify" | "set_role"
  description: string;  // human-readable, e.g. "Skupina → PILOTY pro 5 položek"
  changes: UndoChange[];
}

interface UndoState {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
  popRedo: () => UndoEntry | undefined;
  pushRedo: (entry: UndoEntry) => void;
  clearRedo: () => void;
  clear: () => void;
}

export const useUndoStore = create<UndoState>()((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: (entry) => {
    set((s) => {
      const stack = [...s.undoStack, entry];
      if (stack.length > MAX_UNDO) stack.shift();
      return { undoStack: stack, redoStack: [] };
    });
  },

  popUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return undefined;
    const entry = undoStack[undoStack.length - 1];
    set((s) => ({ undoStack: s.undoStack.slice(0, -1) }));
    return entry;
  },

  popRedo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return undefined;
    const entry = redoStack[redoStack.length - 1];
    set((s) => ({ redoStack: s.redoStack.slice(0, -1) }));
    return entry;
  },

  pushRedo: (entry) => {
    set((s) => ({ redoStack: [...s.redoStack, entry] }));
  },

  clearRedo: () => set({ redoStack: [] }),

  clear: () => set({ undoStack: [], redoStack: [] }),
}));
