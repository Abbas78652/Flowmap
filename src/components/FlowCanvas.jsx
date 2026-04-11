// src/components/FlowCanvas.jsx
// The main flow builder canvas — fully theme-aware with collapsible sidebar

import React, { useCallback, useRef, useState } from 'react';
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
import { themes } from '../utils/theme';
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
  const theme         = useStore(s => s.theme);
  const t             = themes[theme];

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const [legendOpen, setLegendOpen]      = useState(true);
  const reactFlowWrapper  = useRef(null);
  const [rfInstance, setRfInstance] = React.useState(null);

  // Sync local UP to store (debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => { setStoreNodes(nodes); }, 50);
    return () => clearTimeout(timer);
  }, [nodes]); // eslint-disable-line

  React.useEffect(() => {
    const timer = setTimeout(() => { setStoreEdges(edges); }, 50);
    return () => clearTimeout(timer);
  }, [edges]); // eslint-disable-line

  // Sync store DOWN (external changes: delete, load)
  const prevStoreNodes = React.useRef(storeNodes);
  React.useEffect(() => {
    if (prevStoreNodes.current !== storeNodes) {
      prevStoreNodes.current = storeNodes;
      setNodes(storeNodes);
    }
  }, [storeNodes]); // eslint-disable-line

  const prevStoreEdges = React.useRef(storeEdges);
  React.useEffect(() => {
    if (prevStoreEdges.current !== storeEdges) {
      prevStoreEdges.current = storeEdges;
      setEdges(storeEdges);
    }
  }, [storeEdges]); // eslint-disable-line

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({
      ...params,
      type:      'smoothstep',
      animated:  true,
      style:     { stroke: t.accent, strokeWidth: 2 },
      markerEnd: { type: 'ArrowClosed', color: t.accent },
    }, eds));
  }, [setEdges, t.accent]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    if (!rfInstance || !dragTemplate) return;
    const bounds   = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    setNodes(nds => [...nds, createNode(dragTemplate.nodeType, dragTemplate, position)]);
  }, [rfInstance, dragTemplate, setNodes]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleAutoLayout = useCallback(() => {
    setNodes(nds => applyAutoLayout(nds, edges));
  }, [edges, setNodes]);

  const handleClear = useCallback(() => {
    if (window.confirm('Clear all nodes? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  const isEmpty = nodes.length === 0;
  const isLight = theme === 'light';

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%', background: t.bg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
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
        {/* Background grid */}
        <Background
          color={isLight ? '#d0dce8' : '#1a2a3a'}
          gap={28} size={1.5} variant="dots"
        />

        {/* Controls */}
        <Controls style={{
          background:   t.bgCard,
          border:       `1px solid ${t.border}`,
          borderRadius: 10,
          boxShadow:    `0 2px 8px ${t.nodeShadow}`,
        }} />

        {/* Minimap */}
        <MiniMap
          nodeColor={n => n.data?.color || t.textMuted}
          maskColor={isLight ? '#f0f4f888' : '#060d1a99'}
          style={{
            background:   t.bgCard,
            border:       `1px solid ${t.border}`,
            borderRadius: 10,
          }}
        />

        {/* Top toolbar */}
        <Panel position="top-right">
          <div style={{ display: 'flex', gap: 8 }}>
            <ToolbarBtn onClick={handleAutoLayout} color={t.textSecondary} bg={t.bgCard} border={t.border}>
              ⬡ Auto Layout
            </ToolbarBtn>
            <ToolbarBtn onClick={onAudit} color="#6c63ff" bg={t.bgCard} border={t.border}>
              🤖 Audit Flow
            </ToolbarBtn>
            <ToolbarBtn onClick={handleClear} color={t.danger} bg={t.bgCard} border={t.border}>
              🗑 Clear
            </ToolbarBtn>
          </div>
        </Panel>

        {/* Legend — collapsible */}
        <Panel position="top-left">
          <div style={{
            background:     t.bgCard,
            border:         `1px solid ${t.border}`,
            borderRadius:   12,
            fontFamily:     '"DM Sans", sans-serif',
            boxShadow:      `0 2px 12px ${t.nodeShadow}`,
            overflow:       'hidden',
            minWidth:       legendOpen ? 160 : 'auto',
            transition:     'all 0.2s ease',
          }}>
            {/* Legend header — always visible */}
            <button
              onClick={() => setLegendOpen(o => !o)}
              title={legendOpen ? 'Collapse legend' : 'Expand legend'}
              style={{
                width:      '100%',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                padding:    '10px 14px',
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap:        8,
                color:      t.textMuted,
                fontSize:   10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                fontFamily: '"DM Sans", sans-serif',
              }}
            >
              <span>📋 LEGEND</span>
              <span style={{ fontSize: 12, color: t.textDim }}>
                {legendOpen ? '◀' : '▶'}
              </span>
            </button>

            {/* Legend body */}
            {legendOpen && (
              <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${t.border}` }}>
                <div style={{ marginTop: 10 }}>
                  {[
                    { color: '#6c63ff', label: 'Trigger'   },
                    { color: '#fdab3d', label: 'Condition' },
                    { color: '#00ca72', label: 'Action'    },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                      <span style={{ color: t.textPrimary, fontSize: 11 }}>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8, paddingTop: 8 }}>
                  <Row label="Nodes"       value={nodes.length} t={t} />
                  <Row label="Connections" value={edges.length} t={t} />
                </div>

                <div style={{ color: t.textDim, fontSize: 9, marginTop: 8, lineHeight: 1.6 }}>
                  Drag nodes from sidebar<br/>
                  Connect: drag between dots<br/>
                  Delete: select + Delete key
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Empty state */}
        {isEmpty && (
          <Panel position="bottom-center">
            <div style={{
              background:   t.bgCard + 'ee',
              border:       `1px dashed ${t.border}`,
              borderRadius: 12,
              padding:      '14px 24px',
              color:        t.textMuted,
              fontSize:     13,
              fontFamily:   '"DM Sans", sans-serif',
              textAlign:    'center',
              boxShadow:    `0 2px 12px ${t.nodeShadow}`,
            }}>
              👈 Drag nodes from the left panel onto this canvas to build your automation flow
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

function ToolbarBtn({ onClick, children, color, bg, border }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:   hover ? color + '22' : bg,
        border:       `1px solid ${hover ? color : border}`,
        borderRadius: 8,
        color:        hover ? color : color,
        fontSize:     12,
        fontWeight:   600,
        padding:      '7px 14px',
        cursor:       'pointer',
        fontFamily:   '"DM Sans", sans-serif',
        transition:   'all 0.15s',
        boxShadow:    `0 1px 4px ${color}22`,
      }}
    >{children}</button>
  );
}

function Row({ label, value, t }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ color: t.textMuted, fontSize: 11 }}>{label}</span>
      <span style={{ color: t.textSecondary, fontSize: 11, fontWeight: 700 }}>{value}</span>
    </div>
  );
}