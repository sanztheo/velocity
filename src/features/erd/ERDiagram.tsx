import { useMemo } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  MiniMap,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useERD } from './useERD';
import TableNode from './TableNode';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ERDiagramProps {
  connectionId: string;
}

export function ERDiagram({ connectionId }: ERDiagramProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, isLoading, refresh } = useERD(connectionId);

  const nodeTypes = useMemo(() => ({
    table: TableNode as any,
  }), []);

  return (
    <div className="h-full w-full bg-background relative">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap 
           nodeColor="#2A2A2A" 
           maskColor="rgba(0,0,0,0.3)" 
           className="bg-muted border border-border" 
        />
        
        <Panel position="top-right">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={refresh} 
            disabled={isLoading}
            className="shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Layout
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
