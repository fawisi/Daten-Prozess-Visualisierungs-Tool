import { useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange } from '@xyflow/react';
import type { Process, ProcessPositions } from '../../bpmn/schema.js';
import type { ConnectionStatus } from '../components/shared/StatusIndicator.js';
import { computeLayout } from '../layout/elk-layout.js';
import { useApiConfig } from '../state/ApiConfig.js';

const DEFAULT_WS_PATH = '/__viso-ws';
const RECONNECT_INTERVAL = 2000;
const POSITION_WRITE_DEBOUNCE = 500;

const NODE_TYPE_MAP: Record<string, string> = {
  'start-event': 'bpmnStart',
  'end-event': 'bpmnEnd',
  'task': 'bpmnTask',
  'gateway': 'bpmnGateway',
};

function processToNodesAndEdges(process: Process): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(process.nodes).map(([id, node]) => ({
    id,
    type: NODE_TYPE_MAP[node.type] ?? 'bpmnTask',
    position: { x: 0, y: 0 },
    data: {
      label: node.label,
      description: node.description,
      nodeType: node.type,
      gatewayType: node.gatewayType,
    },
  }));

  const edges: Edge[] = process.flows.map((flow, i) => ({
    id: `flow-${i}-${flow.from}-${flow.to}`,
    source: flow.from,
    target: flow.to,
    type: 'sequenceFlow',
    data: { label: flow.label },
  }));

  return { nodes, edges };
}

export function useProcessSync() {
  const api = useApiConfig();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isEmpty, setIsEmpty] = useState(true);
  const positionsRef = useRef<ProcessPositions>({});
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadSchema = useCallback(async () => {
    try {
      const [schemaRes, posRes] = await Promise.all([
        fetch(api.endpoints.bpmnSchema, authInit(api.endpoints.authHeader)),
        fetch(api.endpoints.bpmnPositions, authInit(api.endpoints.authHeader)),
      ]);
      const raw = await schemaRes.json();
      // Hub adapter wraps payloads in { ok, data }; Vite returns the raw process.
      const process: Process = raw?.data ?? raw;
      const positions: ProcessPositions = posRes.ok ? await posRes.json() : {};
      positionsRef.current = positions;

      const nodeCount = Object.keys(process.nodes).length;
      setIsEmpty(nodeCount === 0);

      if (nodeCount === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const { nodes: rawNodes, edges: rawEdges } = processToNodesAndEdges(process);
      const laidOut = await computeLayout(rawNodes, rawEdges, positions);
      setNodes(laidOut);
      setEdges(rawEdges);
    } catch (err) {
      console.error('Failed to load BPMN schema:', err);
    }
  }, [api]);

  // WebSocket connection
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let mounted = true;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = resolveWsUrl(api.endpoints.wsUrl ?? DEFAULT_WS_PATH, protocol);
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
          if (msg.type === 'schema-changed' && msg.diagramType === 'bpmn') {
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

  // Debounced position writer
  const savePositions = useCallback((updatedNodes: Node[]) => {
    const positions: ProcessPositions = {};
    for (const node of updatedNodes) {
      positions[node.id] = { x: node.position.x, y: node.position.y };
    }
    positionsRef.current = positions;

    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }
    writeTimeoutRef.current = setTimeout(() => {
      fetch(api.endpoints.bpmnPositions, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(api.endpoints.authHeader ? { Authorization: api.endpoints.authHeader } : {}),
        },
        body: JSON.stringify(positions),
      }).catch((err) => console.error('Failed to save BPMN positions:', err));
    }, POSITION_WRITE_DEBOUNCE);
  }, [api]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);
        const hasDrag = changes.some((c) => c.type === 'position');
        if (hasDrag) {
          savePositions(updated);
        }
        return updated;
      });
    },
    [savePositions]
  );

  const applyAutoLayout = useCallback(async () => {
    if (nodes.length === 0) return;
    const laidOut = await computeLayout(nodes, edges, {});
    setNodes(laidOut);
    savePositions(laidOut);
  }, [nodes, edges, savePositions]);

  const applyPositions = useCallback((positions: ProcessPositions) => {
    setNodes((prev) =>
      prev.map((n) =>
        positions[n.id]
          ? { ...n, position: { x: positions[n.id].x, y: positions[n.id].y } }
          : n
      )
    );
  }, []);

  const snapshotPositions = useCallback((): ProcessPositions => {
    const snap: ProcessPositions = {};
    for (const n of nodes) snap[n.id] = { x: n.position.x, y: n.position.y };
    return snap;
  }, [nodes]);

  return {
    nodes,
    edges,
    status,
    isEmpty,
    onNodesChange,
    setNodes,
    setEdges,
    applyAutoLayout,
    applyPositions,
    snapshotPositions,
    savePositions,
  };
}

function authInit(authHeader: string | undefined): RequestInit | undefined {
  if (!authHeader) return undefined;
  return { headers: { Authorization: authHeader } };
}

function resolveWsUrl(wsPath: string, protocol: 'http:' | 'https:' | 'ws:' | 'wss:' | string): string {
  if (/^wss?:\/\//.test(wsPath)) return wsPath;
  if (/^https?:\/\//.test(wsPath)) {
    return wsPath.replace(/^http/, 'ws');
  }
  return `${protocol}//${window.location.host}${wsPath}`;
}
