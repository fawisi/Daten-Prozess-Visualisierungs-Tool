import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_HISTORY = 50;

export interface HistoryController<T> {
  record: (snapshot: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  reset: (snapshot: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<T>(): HistoryController<T> {
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const currentRef = useRef<T | null>(null);
  const [, tick] = useState(0);

  const record = useCallback((snapshot: T) => {
    if (currentRef.current !== null) {
      pastRef.current.push(currentRef.current);
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
    }
    currentRef.current = snapshot;
    futureRef.current = [];
    tick((v) => v + 1);
  }, []);

  const undo = useCallback((): T | null => {
    const prev = pastRef.current.pop();
    if (prev === undefined) return null;
    if (currentRef.current !== null) futureRef.current.push(currentRef.current);
    currentRef.current = prev;
    tick((v) => v + 1);
    return prev;
  }, []);

  const redo = useCallback((): T | null => {
    const next = futureRef.current.pop();
    if (next === undefined) return null;
    if (currentRef.current !== null) pastRef.current.push(currentRef.current);
    currentRef.current = next;
    tick((v) => v + 1);
    return next;
  }, []);

  const reset = useCallback((snapshot: T) => {
    pastRef.current = [];
    futureRef.current = [];
    currentRef.current = snapshot;
    tick((v) => v + 1);
  }, []);

  return {
    record,
    undo,
    redo,
    reset,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}

export interface UseHistoryShortcutsOptions {
  onUndo: () => void;
  onRedo: () => void;
  enabled?: boolean;
}

export function useHistoryShortcuts({ onUndo, onRedo, enabled = true }: UseHistoryShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest('.cm-editor') !== null;
      if (inEditable) return;

      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        onRedo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUndo, onRedo, enabled]);
}
