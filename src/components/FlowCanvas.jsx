// src/components/FlowCanvas.jsx
// The main flow builder canvas

import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TriggerNode, ConditionNode, ActionNode } from './FlowNodes';
import { useStore } from '../utils/store';
import { createNode, applyAutoLayout } from '../utils/flowBuilder';

const nodeTypes = {
  triggerNode:   TriggerNode,
  conditionNode: ConditionNode,
  actionNode:    ActionNode,
};

export default function FlowCanvas({ onAudit }) {
  const storeNodes    = useStore(s => s.nodes);
  const storeEdges    = useStore(s => s.edges);
  const setStoreNodes = useStore(s => s.setNodes);
  const setStoreEdges = useStore(s => s.setEdges);
  const dragTemplate  = useStore(s => s.dragTemplate);

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState(null);

  // Sync local state UP to store (debounced to prevent loops)
React.useEffect(() => {
  const timer = setTimeout(() => { setStoreNodes(nodes); }, 50);
  return () => clearTimeout(timer);
}, [nodes]); // eslint-disable-line

React.useEffect(() => {
  const timer = setTimeout(() => { setStoreEdges(edges); }, 50);
  return () => clearTimeout(timer);
}, [edges]); // eslint-disable-line

// Sync store DOWN to local only when store changes externally (delete, load)
const prevStoreNodes = React.useRef(storeNodes);
React.useEffect(() => {
  if (prevStoreNodes.current !== storeNodes) {
    prevStoreNodes.current = storeNodes;
    setNodes(storeNodes);
  }
}, [storeNodes]); // eslint-disable-line

  // Connect two nodes with an edge
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({
      ...params,
      type:      'smoothstep',
      animated:  true,
      style:     { stroke: '#7eb8f7', strokeWidth: 2 },
      markerEnd: { type: 'ArrowClosed', color: '#7eb8f7' },
    }, eds));
  }, [setEdges]);

  // Drop node onto canvas
  const onDrop = useCallback((event) => {
    event.preventDefault();
    if (!reactFlowInstance || !dragTemplate) return;

    const bounds   = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    const newNode = createNode(dragTemplate.nodeType, dragTemplate, position);
    setNodes(nds => [...nds, newNode]);
  }, [reactFlowInstance, dragTemplate, setNodes]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Auto-layout button
  const handleAutoLayout = useCallback(() => {
    setNodes(nds => applyAutoLayout(nds, edges));
  }, [edges, setNodes]);

  // Clear canvas
  const handleClear = useCallback(() => {
    if (window.confirm('Clear all nodes? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  const isEmpty = nodes.length === 0;

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%', background: '#060d1a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a2a3a" gap={28} size={1.5} variant="dots" />

        <Controls style={{ background: '#0d1f33', border: '1px solid #1a3a5c', borderRadius: 10 }} />

        <MiniMap
          nodeColor={n => n.data?.color || '#444'}
          maskColor="#060d1a99"
          style={{ background: '#0d1f33', border: '1px solid #1a3a5c', borderRadius: 10 }}
        />

        {/* Top toolbar */}
        <Panel position="top-right">
          <div style={{ display: 'flex', gap: 8 }}>
            <ToolbarBtn onClick={handleAutoLayout} title="Auto-arrange nodes" color="#7eb8f7">
              ⬡ Auto Layout
            </ToolbarBtn>
            <ToolbarBtn onClick={onAudit} title="AI audit this flow" color="#6c63ff">
              🤖 Audit Flow
            </ToolbarBtn>
            <ToolbarBtn onClick={handleClear} title="Clear canvas" color="#e2445c">
              🗑 Clear
            </ToolbarBtn>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="top-left">
          <LegendPanel nodeCount={nodes.length} edgeCount={edges.length} />
        </Panel>

        {/* Empty state */}
        {isEmpty && (
          <Panel position="bottom-center">
            <div style={{
              background:   '#0d1f33ee',
              border:       '1px dashed #1a3a5c',
              borderRadius: 12,
              padding:      '14px 24px',
              color:        '#4a6080',
              fontSize:     13,
              fontFamily:   '"DM Sans", sans-serif',
              textAlign:    'center',
            }}>
              👈 Drag nodes from the left panel onto this canvas to build your automation flow
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

function ToolbarBtn({ onClick, children, color }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:   hover ? color + '22' : '#0d1f33',
        border:       `1px solid ${hover ? color : '#1a3a5c'}`,
        borderRadius: 8,
        color:        hover ? color : '#7eb8f7',
        fontSize:     12,
        fontWeight:   600,
        padding:      '7px 14px',
        cursor:       'pointer',
        fontFamily:   '"DM Sans", sans-serif',
        transition:   'all 0.15s',
      }}
    >{children}</button>
  );
}

function LegendPanel({ nodeCount, edgeCount }) {
  return (
    <div style={{
      background:   '#0d1f33ee',
      border:       '1px solid #1a3a5c',
      borderRadius: 12,
      padding:      '12px 16px',
      fontFamily:   '"DM Sans", sans-serif',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ color: '#4a6080', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>
        LEGEND
      </div>
      {[
        { color: '#6c63ff', label: 'Trigger'   },
        { color: '#fdab3d', label: 'Condition' },
        { color: '#00ca72', label: 'Action'    },
      ].map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
          <span style={{ color: '#c8d8e8', fontSize: 11 }}>{item.label}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #1a2f4a', marginTop: 10, paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ color: '#4a6080', fontSize: 11 }}>Nodes</span>
          <span style={{ color: '#7eb8f7', fontSize: 11, fontWeight: 700 }}>{nodeCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#4a6080', fontSize: 11 }}>Connections</span>
          <span style={{ color: '#7eb8f7', fontSize: 11, fontWeight: 700 }}>{edgeCount}</span>
        </div>
      </div>
      <div style={{ color: '#2a4060', fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        Drag nodes from sidebar<br/>
        Connect: drag between dots<br/>
        Delete: select + Delete key
      </div>
    </div>
  );
}
