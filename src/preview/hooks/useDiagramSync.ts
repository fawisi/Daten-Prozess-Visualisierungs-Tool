import { useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { Diagram, Positions, Relation } from '../../schema.js';
import type { ConnectionStatus } from '../components/StatusIndicator.js';
import { computeLayout } from '../layout/elk-layout.js';
import { useApiConfig } from '../state/ApiConfig.js';
import { authInit, resolveWsUrl } from '../state/apiHelpers.js';
import { isInitialAutoLayoutNeeded } from './auto-layout.js';
import { normalizeRelations } from '../normalize-relations.js';

const DEFAULT_WS_PATH = '/__viso-ws';
const RECONNECT_INTERVAL = 2000;
const POSITION_WRITE_DEBOUNCE = 500;

function diagramToNodesAndEdges(diagram: Diagram): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(diagram.tables).map(([name, table]) => ({
    id: name,
    type: 'table',
    position: { x: 0, y: 0 },
    data: {
      label: name,
      columns: table.columns,
      description: table.description,
      status: table.status,
    },
  }));

  const edges: Edge[] = diagram.relations.map((rel, i) => ({
    id: `rel-${i}-${rel.from.table}-${rel.from.column}`,
    source: rel.from.table,
    sourceHandle: `${rel.from.column}-source`,
    target: rel.to.table,
    targetHandle: `${rel.to.column}-target`,
    type: 'relation',
    data: { relationType: rel.type },
  }));

  return { nodes, edges };
}

export function useDiagramSync() {
  const api = useApiConfig();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isEmpty, setIsEmpty] = useState(true);
  const positionsRef = useRef<Positions>({});
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // MA-9: one-shot guard so the initial ELK layout is persisted exactly
  // once per hook lifecycle, even when the WebSocket reconnects.
  const autoLayoutDoneRef = useRef(false);

  // Debounced position writer
  const savePositions = useCallback((updatedNodes: Node[]) => {
    const positions: Positions = {};
    for (const node of updatedNodes) {
      positions[node.id] = { x: node.position.x, y: node.position.y };
    }
    positionsRef.current = positions;

    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }
    writeTimeoutRef.current = setTimeout(() => {
      fetch(api.endpoints.erdPositions, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(api.endpoints.authHeader ? { Authorization: api.endpoints.authHeader } : {}),
        },
        body: JSON.stringify(positions),
      }).catch((err) => console.error('Failed to save positions:', err));
    }, POSITION_WRITE_DEBOUNCE);
  }, [api]);

  const loadSchema = useCallback(async () => {
    try {
      const [schemaRes, posRes] = await Promise.all([
        fetch(api.endpoints.erdSchema, authInit(api.endpoints.authHeader)),
        fetch(api.endpoints.erdPositions, authInit(api.endpoints.authHeader)),
      ]);
      const raw = await schemaRes.json();
      // Hub adapter wraps payloads in { ok, data }; Vite returns the raw diagram.
      const diagram: Diagram = normalizeRelations(raw?.data ?? raw);
      const positions: Positions = posRes.ok ? await posRes.json() : {};
      positionsRef.current = positions;

      const tableCount = Object.keys(diagram.tables).length;
      setIsEmpty(tableCount === 0);

      if (tableCount === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const { nodes: rawNodes, edges: rawEdges } = diagramToNodesAndEdges(diagram);
      const laidOut = await computeLayout(rawNodes, rawEdges, positions);
      setNodes(laidOut);
      setEdges(rawEdges);

      // MA-9: persist the initial ELK arrangement exactly once when no
      // sidecar exists yet — pinning the layout so subsequent reloads
      // don't reshuffle it after a single drag.
      if (
        !autoLayoutDoneRef.current &&
        isInitialAutoLayoutNeeded(positions, laidOut.length)
      ) {
        autoLayoutDoneRef.current = true;
        savePositions(laidOut);
      }
    } catch (err) {
      console.error('Failed to load schema:', err);
    }
  }, [api, savePositions]);

  // WebSocket connection
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let mounted = true;

    function connect() {
      const wsUrl = resolveWsUrl(api.endpoints.wsUrl ?? DEFAULT_WS_PATH, window.location.protocol);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mounted) {
          setStatus('connected');
          loadSchema(); // Full reload on connect
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'schema-changed' && (!msg.diagramType || msg.diagramType === 'erd')) {
            loadSchema();
          }
        } catch {
          // Ignore invalid messages
        }
      };

      ws.onclose = () => {
        if (mounted) {
          setStatus('reconnecting');
          reconnectTimer = setTimeout(connect, RECONNECT_INTERVAL);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      mounted = false;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [loadSchema, api]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);

        // Save positions on drag
        const hasDrag = changes.some((c) => c.type === 'position');
        if (hasDrag) {
          savePositions(updated);
        }
        return updated;
      });
    },
    [savePositions]
  );

  // Local edge state (selection, internal updates). Persistent edge
  // create/delete go through `onConnect` / `onEdgesDelete` and round-trip
  // via the source file + WebSocket reload, so we strip "remove" changes
  // here — they are handled in `onEdgesDelete` which writes the source.
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  // Handle "${column}-source" / "${column}-target". The id can itself
  // contain dashes (e.g. "user_id-source"), so strip the suffix instead
  // of splitting.
  const handleColumn = (handleId: string | null | undefined, suffix: '-source' | '-target'): string | null => {
    if (!handleId || !handleId.endsWith(suffix)) return null;
    return handleId.slice(0, -suffix.length);
  };

  const writeDiagram = useCallback(
    async (mutate: (doc: Diagram) => Diagram | null) => {
      const res = await fetch(api.endpoints.erdSource, authInit(api.endpoints.authHeader));
      const raw = await res.text();
      let doc: Diagram;
      try {
        doc = normalizeRelations(JSON.parse(raw)) as Diagram;
      } catch {
        doc = { format: 'viso-erd-v1', tables: {}, relations: [] };
      }
      if (!doc.relations) doc.relations = [];
      const next = mutate(doc);
      if (!next) return;
      await fetch(api.endpoints.erdSource, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
          ...(api.endpoints.authHeader ? { Authorization: api.endpoints.authHeader } : {}),
        },
        body: JSON.stringify(next, null, 2),
      });
    },
    [api]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const fromColumn = handleColumn(connection.sourceHandle, '-source');
      const toColumn = handleColumn(connection.targetHandle, '-target');
      if (!fromColumn || !toColumn) return;
      // Default to many-to-one — typical FK -> PK; user can refine later.
      const newRel: Relation = {
        from: { table: connection.source, column: fromColumn },
        to: { table: connection.target, column: toColumn },
        type: 'many-to-one',
      };
      try {
        await writeDiagram((doc) => {
          const exists = doc.relations.some(
            (r) =>
              r.from.table === newRel.from.table &&
              r.from.column === newRel.from.column &&
              r.to.table === newRel.to.table &&
              r.to.column === newRel.to.column
          );
          if (exists) return null;
          return { ...doc, relations: [...doc.relations, newRel] };
        });
      } catch (err) {
        console.error('Failed to add relation:', err);
      }
    },
    [writeDiagram]
  );

  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      if (deleted.length === 0) return;
      try {
        await writeDiagram((doc) => {
          const remaining = doc.relations.filter((rel) => {
            return !deleted.some((edge) => {
              const fromColumn = handleColumn(edge.sourceHandle, '-source');
              const toColumn = handleColumn(edge.targetHandle, '-target');
              return (
                rel.from.table === edge.source &&
                rel.to.table === edge.target &&
                rel.from.column === fromColumn &&
                rel.to.column === toColumn
              );
            });
          });
          if (remaining.length === doc.relations.length) return null;
          return { ...doc, relations: remaining };
        });
      } catch (err) {
        console.error('Failed to delete relation(s):', err);
      }
    },
    [writeDiagram]
  );

  const applyAutoLayout = useCallback(async () => {
    if (nodes.length === 0) return;
    const laidOut = await computeLayout(nodes, edges, {});
    setNodes(laidOut);
    savePositions(laidOut);
  }, [nodes, edges, savePositions]);

  const applyPositions = useCallback((positions: Positions) => {
    setNodes((prev) =>
      prev.map((n) =>
        positions[n.id]
          ? { ...n, position: { x: positions[n.id].x, y: positions[n.id].y } }
          : n
      )
    );
  }, []);

  const snapshotPositions = useCallback((): Positions => {
    const snap: Positions = {};
    for (const n of nodes) snap[n.id] = { x: n.position.x, y: n.position.y };
    return snap;
  }, [nodes]);

  return {
    nodes,
    edges,
    status,
    isEmpty,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgesDelete,
    setNodes,
    setEdges,
    applyAutoLayout,
    applyPositions,
    snapshotPositions,
    savePositions,
  };
}
