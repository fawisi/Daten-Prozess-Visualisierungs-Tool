import { useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange } from '@xyflow/react';
import type { Diagram, Positions } from '../../schema.js';
import type { ConnectionStatus } from '../components/StatusIndicator.js';
import { computeLayout } from '../layout/elk-layout.js';

const WS_PATH = '/__viso-ws';
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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isEmpty, setIsEmpty] = useState(true);
  const positionsRef = useRef<Positions>({});
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadSchema = useCallback(async () => {
    try {
      const [schemaRes, posRes] = await Promise.all([
        fetch('/__viso-api/schema'),
        fetch('/__viso-api/positions'),
      ]);
      const diagram: Diagram = await schemaRes.json();
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
    } catch (err) {
      console.error('Failed to load schema:', err);
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
  }, [loadSchema]);

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
      fetch('/__viso-api/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positions),
      }).catch((err) => console.error('Failed to save positions:', err));
    }, POSITION_WRITE_DEBOUNCE);
  }, []);

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
    setNodes,
    setEdges,
    applyAutoLayout,
    applyPositions,
    snapshotPositions,
    savePositions,
  };
}
