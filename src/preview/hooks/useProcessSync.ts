import { useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { Process, ProcessPositions, Flow } from '../../bpmn/schema.js';
import type { ConnectionStatus } from '../components/shared/StatusIndicator.js';
import { computeLayout } from '../layout/elk-layout.js';
import { useApiConfig } from '../state/ApiConfig.js';
import { authInit, resolveWsUrl } from '../state/apiHelpers.js';
import { isInitialAutoLayoutNeeded } from './auto-layout.js';

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
      status: node.status,
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
  // MA-9: one-shot guard for the initial-layout persist.
  const autoLayoutDoneRef = useRef(false);

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

      if (
        !autoLayoutDoneRef.current &&
        isInitialAutoLayoutNeeded(positions, laidOut.length)
      ) {
        autoLayoutDoneRef.current = true;
        savePositions(laidOut);
      }
    } catch (err) {
      console.error('Failed to load BPMN schema:', err);
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

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const writeProcess = useCallback(
    async (mutate: (doc: Process) => Process | null) => {
      const res = await fetch(api.endpoints.bpmnSource, authInit(api.endpoints.authHeader));
      const raw = await res.text();
      let doc: Process;
      try {
        doc = JSON.parse(raw) as Process;
      } catch {
        doc = { format: 'viso-bpmn-v1', nodes: {}, flows: [] };
      }
      if (!doc.flows) doc.flows = [];
      const next = mutate(doc);
      if (!next) return;
      await fetch(api.endpoints.bpmnSource, {
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
      const newFlow: Flow = { from: connection.source, to: connection.target };
      try {
        await writeProcess((doc) => {
          const exists = doc.flows.some(
            (f) => f.from === newFlow.from && f.to === newFlow.to
          );
          if (exists) return null;
          return { ...doc, flows: [...doc.flows, newFlow] };
        });
      } catch (err) {
        console.error('Failed to add flow:', err);
      }
    },
    [writeProcess]
  );

  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      if (deleted.length === 0) return;
      try {
        await writeProcess((doc) => {
          const remaining = doc.flows.filter(
            (flow) =>
              !deleted.some((edge) => flow.from === edge.source && flow.to === edge.target)
          );
          if (remaining.length === doc.flows.length) return null;
          return { ...doc, flows: remaining };
        });
      } catch (err) {
        console.error('Failed to delete flow(s):', err);
      }
    },
    [writeProcess]
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
