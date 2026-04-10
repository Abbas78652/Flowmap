// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { useStore } from '../utils/store';
import { TRIGGER_TEMPLATES, CONDITION_TEMPLATES, ACTION_TEMPLATES, quickAudit } from '../utils/flowBuilder';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'build',  icon: '🧱', label: 'Build'  },
  { id: 'flows',  icon: '📂', label: 'Flows'  },
  { id: 'audit',  icon: '🤖', label: 'Audit'  },
];

export default function Sidebar({ onAuditRequest }) {
  const activeTab     = useStore(s => s.activePanel);
  const setActiveTab  = useStore(s => s.setActivePanel);
  const auditResult   = useStore(s => s.auditResult);
  const nodes         = useStore(s => s.nodes);
  const edges         = useStore(s => s.edges);
  const localWarnings = quickAudit(nodes, edges);

  return (
    <div style={{
      width: 300, height: '100%',
      background: '#080f1e', borderRight: '1px solid #1a2f4a',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"DM Sans", sans-serif', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #1a2f4a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #1f76c2 0%, #6c63ff 100%)',
            borderRadius: 10, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18,
          }}>🗺️</div>
          <div>
            <div style={{ color: '#e8f0fe', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>FlowMap</div>
            <div style={{ color: '#4a6080', fontSize: 11 }}>Automation Builder</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2f4a', padding: '0 8px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '11px 4px',
            color: activeTab === tab.id ? '#7eb8f7' : '#4a6080',
            borderBottom: activeTab === tab.id ? '2px solid #7eb8f7' : '2px solid transparent',
            fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
          }}>
            <span style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>{tab.icon}</span>
            {tab.label}
            {tab.id === 'audit' && auditResult && (
              <span style={{ marginLeft: 4, background: '#6c63ff', color: '#fff', borderRadius: 99, fontSize: 9, padding: '0 5px', fontWeight: 800 }}>NEW</span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {activeTab === 'build' && <BuildPanel localWarnings={localWarnings} />}
        {activeTab === 'flows' && <FlowsPanel />}
        {activeTab === 'audit' && <AuditPanel onAuditRequest={onAuditRequest} localWarnings={localWarnings} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BUILD PANEL
// ─────────────────────────────────────────────
function BuildPanel({ localWarnings }) {
  const setDragTemplate = useStore(s => s.setDragTemplate);
  const onDragStart = (template, nodeType) => (event) => {
    setDragTemplate({ ...template, nodeType });
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div>
      {localWarnings.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {localWarnings.map((w, i) => (
            <div key={i} style={{
              background: w.type === 'error' ? '#1a0505' : w.type === 'warning' ? '#1a0f00' : '#001020',
              border: `1px solid ${w.type === 'error' ? '#e2445c44' : w.type === 'warning' ? '#fdab3d44' : '#1f76c244'}`,
              borderRadius: 7, padding: '8px 10px', marginBottom: 6,
              color: w.type === 'error' ? '#e2445c' : w.type === 'warning' ? '#fdab3d' : '#7eb8f7',
              fontSize: 11, lineHeight: 1.5,
            }}>
              {w.type === 'error' ? '🔴' : w.type === 'warning' ? '⚠️' : 'ℹ️'} {w.message}
            </div>
          ))}
        </div>
      )}
      <NodeGroup label="⚡ TRIGGERS"   color="#6c63ff" templates={TRIGGER_TEMPLATES}   onDragStart={onDragStart} nodeType="trigger"   />
      <NodeGroup label="🔀 CONDITIONS" color="#fdab3d" templates={CONDITION_TEMPLATES} onDragStart={onDragStart} nodeType="condition"  />
      <NodeGroup label="⚙️ ACTIONS"   color="#00ca72" templates={ACTION_TEMPLATES}    onDragStart={onDragStart} nodeType="action"    />
    </div>
  );
}

function NodeGroup({ label, color, templates, onDragStart, nodeType }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
        padding: '4px 0', marginBottom: 8,
      }}>
        {label}
        <span style={{ fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && templates.map(t => (
        <div key={t.id} draggable onDragStart={onDragStart(t, nodeType)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 11px', marginBottom: 5,
            background: '#0d1626', border: `1px solid ${color}33`,
            borderRadius: 9, cursor: 'grab', transition: 'all 0.15s', userSelect: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = color + '11'; e.currentTarget.style.borderColor = color + '77'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0d1626';    e.currentTarget.style.borderColor = color + '33'; }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
          <div>
            <div style={{ color: '#c8d8e8', fontSize: 11, fontWeight: 600 }}>{t.label}</div>
            <div style={{ color: '#3a5070', fontSize: 10, lineHeight: 1.4, marginTop: 1 }}>{t.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// FLOWS PANEL
// ─────────────────────────────────────────────
function FlowsPanel() {
  const flows          = useStore(s => s.savedFlows);
  const loadFlow       = useStore(s => s.loadFlow);
  const deleteFlow     = useStore(s => s.deleteFlow);
  const saveFlow       = useStore(s => s.saveFlow);
  const renameFlow     = useStore(s => s.renameFlow);
  const activateFlow   = useStore(s => s.activateFlow);
  const deactivateFlow = useStore(s => s.deactivateFlow);
  const activating     = useStore(s => s.activating);
  const currentFlow    = useStore(s => s.currentFlowName);
  const nodes          = useStore(s => s.nodes);

  const [name, setName]           = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedLogs, setExpandedLogs]   = useState(null);

  const handleSave = () => {
    const n = name.trim() || currentFlow || 'Untitled Flow';
    saveFlow(n);
    setName('');
    toast.success(`Flow "${n}" saved`);
  };

  const handleRenameCommit = (flowId) => {
    if (editName.trim()) renameFlow(flowId, editName.trim());
    setEditingId(null);
  };

  const handleDelete = (flowId) => {
    if (confirmDelete === flowId) {
      deleteFlow(flowId);
      setConfirmDelete(null);
      toast.success('Flow deleted');
    } else {
      setConfirmDelete(flowId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleToggleActive = async (flow) => {
    if (flow.active) {
      const result = await deactivateFlow(flow.id);
      if (result.success) toast.success(`"${flow.name}" deactivated — webhooks removed`);
      else toast.error(`Deactivation failed: ${result.error}`);
    } else {
      toast.loading(`Activating "${flow.name}"...`, { id: 'activate' });
      const result = await activateFlow(flow.id);
      toast.dismiss('activate');
      if (result.success) {
        const whCount = result.webhooks?.length || 0;
        toast.success(`"${flow.name}" activated — ${whCount} webhook${whCount !== 1 ? 's' : ''} registered in monday.com`);
        if (result.errors?.length) toast(`⚠️ ${result.errors.join(', ')}`, { icon: '⚠️' });
      } else {
        toast.error(`Activation failed: ${result.error}`);
        if (result.errors) result.errors.forEach(e => toast.error(e));
      }
    }
  };

  return (
    <div>
      <SectionLabel>Save Current Flow</SectionLabel>
      {nodes.length === 0 && (
        <div style={{ background: '#0d1626', border: '1px solid #1a2f4a', borderRadius: 8,
          padding: '10px 12px', marginBottom: 12, color: '#3a5070', fontSize: 11, lineHeight: 1.5 }}>
          ℹ️ Build your flow on the canvas first, then save it here.
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={currentFlow || 'Flow name...'}
          style={{
            flex: 1, background: '#0d1626', border: '1px solid #1a3a5c',
            borderRadius: 8, color: '#c8d8e8', fontSize: 12, padding: '8px 10px',
            outline: 'none', fontFamily: '"DM Sans", sans-serif',
          }}
        />
        <button onClick={handleSave} disabled={nodes.length === 0} style={{
          background: nodes.length === 0 ? '#1a2f4a' : 'linear-gradient(135deg, #1f76c2, #6c63ff)',
          border: 'none', borderRadius: 8,
          color: nodes.length === 0 ? '#3a5070' : '#fff',
          fontSize: 13, fontWeight: 700, padding: '8px 14px',
          cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
        }}>💾</button>
      </div>

      <SectionLabel>My Flows ({flows.length})</SectionLabel>
      {flows.length === 0 ? (
        <div style={{ color: '#2a4060', fontSize: 12, textAlign: 'center', padding: '24px 0', lineHeight: 1.7 }}>
          No flows saved yet.<br />Build one and save it above.
        </div>
      ) : (
        flows.map(flow => (
          <FlowCard
            key={flow.id}
            flow={flow}
            isCurrent={flow.name === currentFlow}
            isEditing={editingId === flow.id}
            editName={editName}
            confirmDelete={confirmDelete}
            isActivating={activating === flow.id}
            showLogs={expandedLogs === flow.id}
            onLoad={() => loadFlow(flow)}
            onToggleActive={() => handleToggleActive(flow)}
            onDelete={() => handleDelete(flow.id)}
            onStartRename={() => { setEditingId(flow.id); setEditName(flow.name); }}
            onRenameChange={setEditName}
            onRenameCommit={() => handleRenameCommit(flow.id)}
            onRenameCancel={() => setEditingId(null)}
            onToggleLogs={() => setExpandedLogs(expandedLogs === flow.id ? null : flow.id)}
          />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FLOW CARD
// ─────────────────────────────────────────────
function FlowCard({
  flow, isCurrent, isEditing, editName, confirmDelete,
  isActivating, showLogs,
  onLoad, onToggleActive, onDelete,
  onStartRename, onRenameChange, onRenameCommit, onRenameCancel,
  onToggleLogs,
}) {
  const execLogs       = useStore(s => s.execLogs);
  const fetchExecLogs  = useStore(s => s.fetchExecLogs);
  const isActive       = flow.active;
  const logs           = execLogs[flow.id] || [];

  useEffect(() => {
    if (showLogs) fetchExecLogs(flow.id);
  }, [showLogs]); // eslint-disable-line

  const statusColor = (status) => {
    if (status === 'action_success' || status === 'completed' || status === 'activated') return '#00ca72';
    if (status === 'action_error'   || status === 'error')                                return '#e2445c';
    if (status === 'condition_failed')                                                    return '#fdab3d';
    return '#7eb8f7';
  };

  return (
    <div style={{
      background: isCurrent ? '#0f2040' : '#0d1626',
      border: `1px solid ${isCurrent ? '#1f76c2' : '#1a2f4a'}`,
      borderRadius: 10, marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px' }}>
        <div
          onClick={onToggleActive}
          title={isActive ? 'Live — click to deactivate' : 'Inactive — click to activate'}
          style={{
            width: 8, height: 8, borderRadius: 50, flexShrink: 0,
            background:   isActivating ? '#fdab3d' : isActive ? '#00ca72' : '#e2445c',
            cursor:       'pointer',
            boxShadow:    isActivating ? '0 0 6px #fdab3d88' : isActive ? '0 0 6px #00ca7288' : '0 0 6px #e2445c88',
            animation:    isActivating ? 'pulse 1s infinite' : 'none',
          }}
        />

        {isEditing ? (
          <input autoFocus value={editName}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel(); }}
            onBlur={onRenameCommit}
            style={{
              flex: 1, background: '#060d1a', border: '1px solid #1f76c2',
              borderRadius: 5, color: '#e8f0fe', fontSize: 12, fontWeight: 600,
              padding: '2px 6px', outline: 'none', fontFamily: '"DM Sans", sans-serif',
            }}
          />
        ) : (
          <div style={{ flex: 1, color: '#c8d8e8', fontSize: 12, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {flow.name}
          </div>
        )}

        <span style={{
          background:   isActive ? '#00ca7222' : '#e2445c22',
          color:        isActive ? '#00ca72'   : '#e2445c',
          border:       `1px solid ${isActive ? '#00ca7244' : '#e2445c44'}`,
          borderRadius: 99, fontSize: 9, fontWeight: 800,
          padding: '1px 7px', flexShrink: 0,
        }}>
          {isActivating ? '...' : isActive ? 'LIVE' : 'OFF'}
        </span>
      </div>

      {/* Meta */}
      <div style={{ padding: '0 12px 8px', color: '#3a5070', fontSize: 10 }}>
        {flow.nodes?.length || 0} nodes · {flow.edges?.length || 0} connections
        {flow.activatedAt && ` · Live since ${new Date(flow.activatedAt).toLocaleDateString()}`}
        {flow.webhookIds?.length > 0 && ` · ${flow.webhookIds.length} webhook${flow.webhookIds.length !== 1 ? 's' : ''}`}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', borderTop: '1px solid #1a2f4a', background: '#080f1e' }}>
        <ActionBtn onClick={onLoad}        color="#7eb8f7">📂 Load</ActionBtn>
        <ActionBtn onClick={onStartRename} color="#fdab3d">✏️ Rename</ActionBtn>
        <ActionBtn
          onClick={onToggleActive}
          color={isActive ? '#e2445c' : '#00ca72'}
          disabled={isActivating}
        >
          {isActivating ? '⏳' : isActive ? '⏸ Stop' : '▶ Run'}
        </ActionBtn>
        <ActionBtn onClick={onToggleLogs}  color="#6c63ff">📋 Logs</ActionBtn>
        <ActionBtn onClick={onDelete}      color="#e2445c" confirming={confirmDelete === flow.id}>
          {confirmDelete === flow.id ? '⚠️ Sure?' : '🗑'}
        </ActionBtn>
      </div>

      {/* Execution logs */}
      {showLogs && (
        <div style={{ borderTop: '1px solid #1a2f4a', maxHeight: 180, overflowY: 'auto', padding: '8px' }}>
          <div style={{ color: '#3a5070', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>
            EXECUTION LOGS
          </div>
          {logs.length === 0 ? (
            <div style={{ color: '#2a4060', fontSize: 11, textAlign: 'center', padding: '8px 0' }}>
              No executions yet. Activate the flow and trigger it in monday.com.
            </div>
          ) : (
            [...logs].reverse().map((log, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: 5,
                borderLeft: `2px solid ${statusColor(log.status)}`,
                paddingLeft: 7,
              }}>
                <div style={{ color: '#2a4060', fontSize: 9, flexShrink: 0, marginTop: 1 }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ color: statusColor(log.status), fontSize: 10, lineHeight: 1.4 }}>
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, color, children, disabled, confirming }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, background: confirming ? '#e2445c22' : hover ? color + '18' : 'transparent',
        border: 'none', borderRight: '1px solid #1a2f4a',
        color: disabled ? '#2a4060' : confirming ? '#e2445c' : hover ? color : '#3a5070',
        fontSize: 9, fontWeight: 700, padding: '8px 2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: '"DM Sans", sans-serif',
        letterSpacing: '0.04em', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

// ─────────────────────────────────────────────
// AUDIT PANEL
// ─────────────────────────────────────────────
function AuditPanel({ onAuditRequest, localWarnings }) {
  const auditResult  = useStore(s => s.auditResult);
  const auditLoading = useStore(s => s.auditLoading);
  const isPro        = useStore(s => s.isPro)();
  const nodes        = useStore(s => s.nodes);

  return (
    <div>
      <SectionLabel>Local Checks</SectionLabel>
      {localWarnings.length === 0 ? (
        <div style={{ color: '#00ca72', fontSize: 12, marginBottom: 16 }}>✅ No basic issues found</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {localWarnings.map((w, i) => (
            <div key={i} style={{
              background: w.type === 'error' ? '#1a0505' : w.type === 'warning' ? '#1a0f00' : '#001020',
              border: `1px solid ${w.type === 'error' ? '#e2445c44' : w.type === 'warning' ? '#fdab3d44' : '#1f76c244'}`,
              borderRadius: 7, padding: '8px 10px', marginBottom: 6,
              color: w.type === 'error' ? '#e2445c' : w.type === 'warning' ? '#fdab3d' : '#7eb8f7',
              fontSize: 11, lineHeight: 1.5,
            }}>
              {w.type === 'error' ? '🔴' : w.type === 'warning' ? '⚠️' : 'ℹ️'} {w.message}
            </div>
          ))}
        </div>
      )}

      <SectionLabel>AI Audit (Pro)</SectionLabel>
      {!isPro ? (
        <div style={{ background: '#0a0a1a', border: '1px solid #6c63ff44', borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
          <div style={{ color: '#e8f0fe', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>AI Audit is a Pro feature</div>
          <div style={{ color: '#4a6080', fontSize: 11, marginBottom: 16, lineHeight: 1.6 }}>
            Get intelligent recommendations, conflict detection, and improvement suggestions powered by Claude AI.
          </div>
          <button style={{
            background: 'linear-gradient(135deg, #6c63ff, #1f76c2)',
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 12, fontWeight: 700, padding: '10px 20px',
            cursor: 'pointer', boxShadow: '0 4px 16px #6c63ff44',
          }}>✦ Upgrade to Pro — $8/mo</button>
        </div>
      ) : (
        <div>
          <button onClick={onAuditRequest} disabled={auditLoading || nodes.length === 0} style={{
            width: '100%', padding: '12px 0',
            background: nodes.length === 0 ? '#1a2f4a' : 'linear-gradient(135deg, #6c63ff, #1f76c2)',
            border: 'none', borderRadius: 10,
            color: nodes.length === 0 ? '#4a6080' : '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: nodes.length > 0 ? '0 4px 18px #6c63ff44' : 'none',
            marginBottom: 14, transition: 'all 0.2s',
          }}>
            {auditLoading ? '🤖 Analyzing...' : '🤖 Run AI Audit'}
          </button>
          {auditResult && (
            <div style={{ background: '#0a0a1a', border: '1px solid #6c63ff33', borderRadius: 10, padding: '14px' }}>
              <div style={{ color: '#6c63ff', fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: '0.06em' }}>🤖 AI ANALYSIS</div>
              <div style={{ color: '#c8d8e8', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{auditResult}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ color: '#4a6080', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}
