import { useState, useCallback, useEffect } from 'react';
import { 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState
} from '@xyflow/react';
import dagre from 'dagre';
import { listTables, getTableSchema, getTableForeignKeys, ForeignKeyInfo } from '@/lib/tauri';
import { TableNodeData } from './TableNode';
import { toast } from 'sonner';

const NODE_WIDTH = 220;
// NODE_HEIGHT not used, calculated dynamically


export function useERD(connectionId: string | null) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadGraph = useCallback(async () => {
    if (!connectionId) return;

    setIsLoading(true);
    try {
      const tables = await listTables(connectionId);
      
      const nodesData: Node<TableNodeData>[] = [];
      const edgesData: Edge[] = [];
      
      // Fetch schema and FKs for all tables
      // For large DBs this might be slow, considering limiting or paginating
      const promises = tables.map(async (table) => {
        const [columns, foreignKeys] = await Promise.all([
          getTableSchema(connectionId, table),
          getTableForeignKeys(connectionId, table)
        ]);
        return { table, columns, foreignKeys };
      });

      const results = await Promise.all(promises);

      // Create Nodes
      results.forEach(({ table, columns }) => {
        nodesData.push({
          id: table,
          type: 'table',
          data: { label: table, columns },
          position: { x: 0, y: 0 }, // Layout will set this
        });
      });

      // Create Edges
      results.forEach(({ table, foreignKeys }) => {
        foreignKeys.forEach((fk: ForeignKeyInfo) => {
          edgesData.push({
            id: `e-${table}-${fk.columnName}-${fk.referencedTable}`,
            source: table,
            sourceHandle: `${fk.columnName}-source`,
            target: fk.referencedTable,
            targetHandle: `${fk.referencedColumn}-target`,
            animated: true,
            style: { stroke: '#aaa' },
            label: fk.constraintName,
          });
        });
      });

      // Layout with Dagre
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'LR' });
      g.setDefaultEdgeLabel(() => ({}));

      nodesData.forEach((node) => {
        // Approximate height based on columns
        const height = 40 + (node.data.columns.length * 28); 
        g.setNode(node.id, { width: NODE_WIDTH, height });
      });

      edgesData.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
      });

      dagre.layout(g);

      const layoutedNodes = nodesData.map((node) => {
        const nodeWithPosition = g.node(node.id);
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - NODE_WIDTH / 2,
            y: nodeWithPosition.y - (40 + (node.data.columns.length * 28)) / 2,
          },
        };
      });

      setNodes(layoutedNodes);
      setEdges(edgesData);
    } catch (error) {
      console.error('Failed to load ERD:', error);
      toast.error('Failed to load diagram: ' + String(error));
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    isLoading,
    refresh: loadGraph
  };
}
