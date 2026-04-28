import { useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { Landscape, LandscapePositions, LandscapeRelation } from '../../landscape/schema.js';
import type { ConnectionStatus } from '../components/shared/StatusIndicator.js';
import { computeLayout } from '../layout/elk-layout.js';
import { useApiConfig } from '../state/ApiConfig.js';
import { authInit, resolveWsUrl } from '../state/apiHelpers.js';
import { isInitialAutoLayoutNeeded } from './auto-layout.js';

const DEFAULT_WS_PATH = '/__viso-ws';
const RECONNECT_INTERVAL = 2000;
const POSITION_WRITE_DEBOUNCE = 500;

function landscapeToNodesAndEdges(landscape: Landscape): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(landscape.nodes).map(([id, node]) => ({
    id,
    type: 'landscapeNode',
    position: { x: 0, y: 0 },
    data: {
      label: node.label,
      description: node.description,
      kind: node.kind,
      // `technology` + `parentId` only exist on L2 kinds; passed through
      // when present so the node component can render them.
      technology: 'technology' in node ? node.technology : undefined,
      status: node.status,
    },
    ...(
      'parentId' in node && node.parentId
        ? { parentId: node.parentId, extent: 'parent' as const }
        : {}
    ),
  }));

  const edges: Edge[] = landscape.relations.map((rel, i) => ({
    id: `lrel-${i}-${rel.from}-${rel.to}`,
    source: rel.from,
    target: rel.to,
    type: 'landscapeRelation',
    data: { label: rel.label, technology: rel.technology },
  }));

  return { nodes, edges };
}

export function useLandscapeSync() {
  const api = useApiConfig();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isEmpty, setIsEmpty] = useState(true);
  const positionsRef = useRef<LandscapePositions>({});
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // MA-9: one-shot guard for the initial-layout persist.
  const autoLayoutDoneRef = useRef(false);

  const savePositions = useCallback(
    (updatedNodes: Node[]) => {
      const positions: LandscapePositions = {};
      for (const node of updatedNodes) {
        positions[node.id] = { x: node.position.x, y: node.position.y };
      }
      positionsRef.current = positions;

      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
      const positionsUrl = api.endpoints.landscapePositions;
      if (!positionsUrl) return;
      writeTimeoutRef.current = setTimeout(() => {
        fetch(positionsUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(api.endpoints.authHeader ? { Authorization: api.endpoints.authHeader } : {}),
          },
          body: JSON.stringify(positions),
        }).catch((err) => console.error('Failed to save landscape positions:', err));
      }, POSITION_WRITE_DEBOUNCE);
    },
    [api]
  );

  const loadSchema = useCallback(async () => {
    try {
      const schemaUrl = api.endpoints.landscapeSchema;
      const positionsUrl = api.endpoints.landscapePositions;
      if (!schemaUrl) return;
      const [schemaRes, posRes] = await Promise.all([
        fetch(schemaUrl, authInit(api.endpoints.authHeader)),
        positionsUrl
          ? fetch(positionsUrl, authInit(api.endpoints.authHeader))
          : Promise.resolve(new Response('{}')),
      ]);
      const raw = await schemaRes.json();
      const landscape: Landscape = raw?.data ?? raw;
      const positions: LandscapePositions = posRes.ok ? await posRes.json() : {};
      positionsRef.current = positions;

      const nodeCount = Object.keys(landscape.nodes).length;
      setIsEmpty(nodeCount === 0);
      if (nodeCount === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const { nodes: rawNodes, edges: rawEdges } = landscapeToNodesAndEdges(landscape);
      const laidOut = await computeLayout(rawNodes, rawEdges, positions);
      setNodes(laidOut);
      setEdges(rawEdges);

      if (
        !autoLayoutDoneRef.current &&
        isInitialAutoLayoutNeeded(positions, laidOut.length)
      ) {
        autoLayoutDoneRef.current = true;
        savePositions(laidOut);
      }
    } catch (err) {
      console.error('Failed to load landscape schema:', err);
    }
  }, [api, savePositions]);

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
          loadSchema();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'schema-changed' && msg.diagramType === 'landscape') {
            loadSchema();
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (mounted) {
          setStatus('reconnecting');
          reconnectTimer = setTimeout(connect, RECONNECT_INTERVAL);
        }
      };

      ws.onerror = () => ws.close();
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
        if (changes.some((c) => c.type === 'position')) {
          savePositions(updated);
        }
        return updated;
      });
    },
    [savePositions]
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const writeLandscape = useCallback(
    async (mutate: (doc: Landscape) => Landscape | null) => {
      const sourceUrl = api.endpoints.landscapeSource;
      if (!sourceUrl) return;
      const res = await fetch(sourceUrl, authInit(api.endpoints.authHeader));
      const raw = await res.text();
      let doc: Landscape;
      try {
        doc = JSON.parse(raw) as Landscape;
      } catch {
        doc = { format: 'viso-landscape-v1', nodes: {}, relations: [] };
      }
      if (!doc.relations) doc.relations = [];
      const next = mutate(doc);
      if (!next) return;
      await fetch(sourceUrl, {
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
      const newRel: LandscapeRelation = {
        from: connection.source,
        to: connection.target,
      };
      try {
        await writeLandscape((doc) => {
          const exists = doc.relations.some(
            (r) => r.from === newRel.from && r.to === newRel.to
          );
          if (exists) return null;
          return { ...doc, relations: [...doc.relations, newRel] };
        });
      } catch (err) {
        console.error('Failed to add landscape relation:', err);
      }
    },
    [writeLandscape]
  );

  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      if (deleted.length === 0) return;
      try {
        await writeLandscape((doc) => {
          const remaining = doc.relations.filter(
            (rel) =>
              !deleted.some((edge) => rel.from === edge.source && rel.to === edge.target)
          );
          if (remaining.length === doc.relations.length) return null;
          return { ...doc, relations: remaining };
        });
      } catch (err) {
        console.error('Failed to delete landscape relation(s):', err);
      }
    },
    [writeLandscape]
  );

  const applyAutoLayout = useCallback(async () => {
    if (nodes.length === 0) return;
    const laidOut = await computeLayout(nodes, edges, {});
    setNodes(laidOut);
    savePositions(laidOut);
  }, [nodes, edges, savePositions]);

  const applyPositions = useCallback((positions: LandscapePositions) => {
    setNodes((prev) =>
      prev.map((n) =>
        positions[n.id]
          ? { ...n, position: { x: positions[n.id].x, y: positions[n.id].y } }
          : n
      )
    );
  }, []);

  const snapshotPositions = useCallback((): LandscapePositions => {
    const snap: LandscapePositions = {};
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
