import React, { createContext, useContext, useMemo } from 'react';

export interface ApiEndpoints {
  erdSchema: string;
  erdPositions: string;
  erdSource: string;
  erdPut: string | null; // null when the adapter uses per-op endpoints (hub mode)
  bpmnSchema: string;
  bpmnPositions: string;
  bpmnSource: string;
  bpmnPut: string | null;
  /** Mode sidecar GET|PUT (simple|bpmn) — P1 two-mode prozess. */
  bpmnMode: string | null;
  /** List of IDs the canvas should hide in simple mode. */
  bpmnHiddenElements: string | null;
  filesList: string | null;
  /** WebSocket URL for live reloads; null disables the live connection. */
  wsUrl: string | null;
  /** Optional Authorization header forwarded on fetch() calls. */
  authHeader?: string;
}

interface ApiConfigValue {
  endpoints: ApiEndpoints;
  fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
  fetchText: (url: string, init?: RequestInit) => Promise<string>;
}

const DEFAULT_ENDPOINTS: ApiEndpoints = {
  erdSchema: '/__viso-api/schema',
  erdPositions: '/__viso-api/positions',
  erdSource: '/__viso-api/source',
  erdPut: null,
  bpmnSchema: '/__viso-api/bpmn/schema',
  bpmnPositions: '/__viso-api/bpmn/positions',
  bpmnSource: '/__viso-api/bpmn/source',
  bpmnPut: null,
  bpmnMode: null, // Vite plugin does not surface mode endpoints today; hub does.
  bpmnHiddenElements: null,
  filesList: '/__viso-api/files',
  wsUrl: null, // vite-plugin resolves same-origin /__viso-ws; preview App.tsx handles explicitly
};

const ApiConfigContext = createContext<ApiConfigValue | null>(null);

export interface ApiConfigProviderProps {
  children: React.ReactNode;
  /** Base URL for the HTTP adapter (e.g. `/api/proxy/viso/ws123`). */
  apiBaseUrl?: string;
  /** Workspace id when using the HTTP adapter. */
  workspaceId?: string;
  /** Authorization header (Bearer token etc.) forwarded on every call. */
  authToken?: string;
  /** Override individual endpoints (advanced). */
  endpoints?: Partial<ApiEndpoints>;
}

/**
 * Configures how the editor talks to its backend. The preview Vite server
 * uses the vite-plugin endpoints (`/__viso-api/*`). Next.js hubs point the
 * component at the Fastify adapter via `apiBaseUrl` + `workspaceId`.
 */
export function ApiConfigProvider({
  children,
  apiBaseUrl,
  workspaceId,
  authToken,
  endpoints,
}: ApiConfigProviderProps) {
  const resolved = useMemo<ApiEndpoints>(() => {
    const defaults = DEFAULT_ENDPOINTS;
    if (!apiBaseUrl || !workspaceId) {
      return { ...defaults, ...endpoints };
    }
    // Hub mode: point everything at the HTTP adapter. The adapter does not
    // currently split "schema" vs "source" or "positions"; the positions /
    // source endpoints are future work, so fall back to the Vite shape when
    // the hub hasn't implemented them yet. Override individual keys via the
    // `endpoints` prop if the hub surfaces more detail.
    const base = apiBaseUrl.replace(/\/$/, '');
    const wsId = encodeURIComponent(workspaceId);
    const hubBase = `${base}/workspace/${wsId}`;
    return {
      erdSchema: `${hubBase}/erd`,
      erdPositions: defaults.erdPositions,
      erdSource: defaults.erdSource,
      erdPut: `${hubBase}/erd`,
      bpmnSchema: `${hubBase}/bpmn`,
      bpmnPositions: defaults.bpmnPositions,
      bpmnSource: defaults.bpmnSource,
      bpmnPut: `${hubBase}/bpmn`,
      bpmnMode: `${hubBase}/bpmn/mode`,
      bpmnHiddenElements: `${hubBase}/bpmn/hidden-elements`,
      filesList: null,
      wsUrl: `${hubBase}/events`,
      // Spread consumer overrides BEFORE the auth header so a partial
      // `endpoints` prop cannot accidentally wipe authentication.
      ...endpoints,
      authHeader: authToken ? `Bearer ${authToken}` : undefined,
    };
  }, [apiBaseUrl, workspaceId, authToken, endpoints]);

  const value = useMemo<ApiConfigValue>(() => {
    const baseHeaders: Record<string, string> = {};
    if (resolved.authHeader) baseHeaders.Authorization = resolved.authHeader;

    async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
      const res = await fetch(url, {
        ...init,
        headers: { ...baseHeaders, ...(init.headers as Record<string, string> | undefined) },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
      return (await res.json()) as T;
    }
    async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
      const res = await fetch(url, {
        ...init,
        headers: { ...baseHeaders, ...(init.headers as Record<string, string> | undefined) },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
      return res.text();
    }
    return { endpoints: resolved, fetchJson, fetchText };
  }, [resolved]);

  return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>;
}

// Stable singleton for the no-provider fallback. Creating a fresh object
// on every `useApiConfig()` call would re-fire every downstream `[api]`
// useEffect and drop the WebSocket on every parent re-render.
const DEFAULT_API: ApiConfigValue = {
  endpoints: DEFAULT_ENDPOINTS,
  fetchJson: async <T,>(url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
    return (await res.json()) as T;
  },
  fetchText: async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
    return res.text();
  },
};

export function useApiConfig(): ApiConfigValue {
  const ctx = useContext(ApiConfigContext);
  return ctx ?? DEFAULT_API;
}
