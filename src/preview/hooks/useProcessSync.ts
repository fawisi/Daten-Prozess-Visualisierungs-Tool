import { useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange } from '@xyflow/react';
import type { Process, ProcessPositions } from '../../bpmn/schema.js';
import type { ConnectionStatus } from '../components/shared/StatusIndicator.js';
import { computeLayout } from '../layout/elk-layout.js';

const WS_PATH = '/__viso-ws';
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
        fetch('/__viso-api/bpmn/schema'),
        fetch('/__viso-api/bpmn/positions'),
      ]);
      const process: Process = await schemaRes.json();
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
  }, []);

  // WebSocket connection
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let mounted = true;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}${WS_PATH}`);
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
  }, [loadSchema]);

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
      fetch('/__viso-api/bpmn/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positions),
      }).catch((err) => console.error('Failed to save BPMN positions:', err));
    }, POSITION_WRITE_DEBOUNCE);
  }, []);

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

  return { nodes, edges, status, isEmpty, onNodesChange, setNodes, setEdges };
}
