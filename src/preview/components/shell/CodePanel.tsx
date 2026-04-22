import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { ChevronDown, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToolStore } from '@/state/useToolStore.js';
import { cn } from '@/lib/utils.js';

const DEBOUNCE_MS = 300;

export type CodePanelLanguage = 'json' | 'dbml';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CodePanelProps {
  title: string;
  language: CodePanelLanguage;
  source: string;
  onSave: (value: string) => Promise<void>;
  validate?: (value: string) => { ok: true } | { ok: false; message: string; line?: number };
}

export function CodePanel({ title, language, source, onSave, validate }: CodePanelProps) {
  const { codePanelOpen, setCodePanelOpen } = useToolStore();
  const [value, setValue] = useState(source);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSourceRef = useRef(source);

  // Sync external source changes (e.g. after canvas mutation)
  useEffect(() => {
    if (source !== lastSourceRef.current && source !== value) {
      setValue(source);
      lastSourceRef.current = source;
    }
  }, [source, value]);

  const extensions = useMemo(() => (language === 'json' ? [json()] : []), [language]);

  const runSave = useCallback(
    async (next: string) => {
      const validation = validate?.(next);
      if (validation && !validation.ok) {
        setStatus('error');
        setError(
          validation.line ? `Line ${validation.line}: ${validation.message}` : validation.message
        );
        return;
      }
      setError(null);
      setStatus('saving');
      try {
        await onSave(next);
        lastSourceRef.current = next;
        setStatus('saved');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [onSave, validate]
  );

  const handleChange = useCallback(
    (next: string) => {
      setValue(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSave(next), DEBOUNCE_MS);
    },
    [runSave]
  );

  if (!codePanelOpen) return null;

  return (
    <section
      className="border-t bg-[#0b0e14] text-[#c9d1d9] flex flex-col shrink-0"
      style={{ height: 260 }}
      aria-label="Code Panel"
    >
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-xs font-mono">
        <div className="flex items-center gap-2">
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">{title}</span>
          <span className="text-[10px] text-muted-foreground/70">({language})</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <button
            type="button"
            onClick={() => setCodePanelOpen(false)}
            className="opacity-60 hover:opacity-100"
            aria-label="Close code panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        <CodeMirror
          value={value}
          onChange={handleChange}
          extensions={extensions}
          theme="dark"
          height="100%"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
          }}
          style={{ height: '100%', fontSize: 12 }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-1.5 border-t border-red-500/40 bg-red-500/10 text-xs font-mono text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="truncate">{error}</span>
        </div>
      )}
    </section>
  );
}

function StatusDot({ status }: { status: SaveStatus }) {
  const cfg: Record<SaveStatus, { label: string; color: string; icon?: React.ReactNode }> = {
    idle: { label: 'Idle', color: 'bg-muted-foreground/60' },
    saving: { label: 'Saving…', color: 'bg-amber-400 animate-pulse' },
    saved: {
      label: 'Saved',
      color: 'bg-emerald-500',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    error: { label: 'Error', color: 'bg-red-500' },
  };
  const c = cfg[status];
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
      <span className={cn('size-2 rounded-full', c.color)} />
      {c.label}
    </span>
  );
}
