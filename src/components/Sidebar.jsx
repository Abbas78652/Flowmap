// src/components/Sidebar.jsx — fully theme-aware with collapsible panel
import React, { useState, useEffect } from 'react';
import { useStore } from '../utils/store';
import { themes } from '../utils/theme';
import { TRIGGER_TEMPLATES, CONDITION_TEMPLATES, ACTION_TEMPLATES, quickAudit } from '../utils/flowBuilder';
import { TEMPLATE_CONFIGS } from './FlowNodes';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'build',  icon: '🧱', label: 'Build'  },
  { id: 'flows',  icon: '📂', label: 'Flows'  },
  { id: 'audit',  icon: '🤖', label: 'Audit'  },
];

export default function Sidebar({ onAuditRequest, collapsed, onToggleCollapse }) {
  const activeTab     = useStore(s => s.activePanel);
  const setActiveTab  = useStore(s => s.setActivePanel);
  const auditResult   = useStore(s => s.auditResult);
  const nodes         = useStore(s => s.nodes);
  const edges         = useStore(s => s.edges);
  const theme         = useStore(s => s.theme);
  const t             = themes[theme];
  const localWarnings = quickAudit(nodes, edges);

  if (collapsed) {
    return (
      <div style={{
        width: 44, height: '100%', background: t.bgSidebar,
        borderRight: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 12, gap: 8, flexShrink: 0,
      }}>
        {/* Expand button */}
        <button onClick={onToggleCollapse} title="Expand sidebar" style={{
          width: 32, height: 32, background: t.bgCard,
          border: `1px solid ${t.border}`, borderRadius: 8,
          cursor: 'pointer', fontSize: 14, color: t.textMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>▶</button>
        {/* Mini tab icons */}
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); onToggleCollapse(); }} title={tab.label} style={{
            width: 32, height: 32, background: activeTab === tab.id ? t.accent + '22' : 'none',
            border: `1px solid ${activeTab === tab.id ? t.accent + '44' : 'transparent'}`,
            borderRadius: 8, cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{tab.icon}</button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      width: 300, height: '100%',
      background: t.bgSidebar, borderRight: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: '"DM Sans", sans-serif', flexShrink: 0,
      transition: 'width 0.2s ease',
    }}>
      {/* Logo + collapse button */}
      <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #1f76c2 0%, #6c63ff 100%)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>🗺️</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: t.textPrimary, fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>FlowMap</div>
          <div style={{ color: t.textDim, fontSize: 10 }}>Automation Builder</div>
        </div>
        {/* Collapse button */}
        <button onClick={onToggleCollapse} title="Collapse sidebar" style={{
          background: 'none', border: `1px solid ${t.border}`, borderRadius: 7,
          color: t.textMuted, fontSize: 13, padding: '4px 8px',
          cursor: 'pointer', flexShrink: 0,
        }}>◀</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, padding: '0 8px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 4px',
            color: activeTab === tab.id ? t.accent : t.textMuted,
            borderBottom: activeTab === tab.id ? `2px solid ${t.accent}` : '2px solid transparent',
            fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
            fontFamily: '"DM Sans", sans-serif',
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
        {activeTab === 'build' && <BuildPanel localWarnings={localWarnings} t={t} />}
        {activeTab === 'flows' && <FlowsPanel t={t} />}
        {activeTab === 'audit' && <AuditPanel onAuditRequest={onAuditRequest} localWarnings={localWarnings} t={t} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BUILD PANEL
// ─────────────────────────────────────────────
function BuildPanel({ localWarnings, t }) {
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
              background: w.type === 'error' ? t.danger + '18' : w.type === 'warning' ? t.warning + '18' : t.accent + '18',
              border: `1px solid ${w.type === 'error' ? t.danger : w.type === 'warning' ? t.warning : t.accent}44`,
              borderRadius: 7, padding: '8px 10px', marginBottom: 6,
              color: w.type === 'error' ? t.danger : w.type === 'warning' ? t.warning : t.accent,
              fontSize: 11, lineHeight: 1.5,
            }}>
              {w.type === 'error' ? '🔴' : w.type === 'warning' ? '⚠️' : 'ℹ️'} {w.message}
            </div>
          ))}
        </div>
      )}
      <NodeGroup label="⚡ TRIGGERS"   color="#6c63ff" templates={TRIGGER_TEMPLATES}   onDragStart={onDragStart} nodeType="trigger"   t={t} />
      <NodeGroup label="🔀 CONDITIONS" color="#fdab3d" templates={CONDITION_TEMPLATES} onDragStart={onDragStart} nodeType="condition"  t={t} />
      <NodeGroup label="⚙️ ACTIONS"   color="#00ca72" templates={ACTION_TEMPLATES}    onDragStart={onDragStart} nodeType="action"    t={t} />
    </div>
  );
}

function NodeGroup({ label, color, templates, onDragStart, nodeType, t }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
        padding: '4px 0', marginBottom: 8, fontFamily: '"DM Sans", sans-serif',
      }}>
        {label}
        <span style={{ fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && templates.map(tmpl => (
        <div key={tmpl.id} draggable onDragStart={onDragStart(tmpl, nodeType)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 11px', marginBottom: 5,
            background: t.bgCard, border: `1px solid ${color}33`,
            borderRadius: 9, cursor: 'grab', transition: 'all 0.15s', userSelect: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = color + '11'; e.currentTarget.style.borderColor = color + '77'; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.bgCard;     e.currentTarget.style.borderColor = color + '33'; }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{tmpl.icon}</span>
          <div>
            <div style={{ color: t.textPrimary, fontSize: 11, fontWeight: 600 }}>{tmpl.label}</div>
            <div style={{ color: t.textMuted, fontSize: 10, lineHeight: 1.4, marginTop: 1 }}>{tmpl.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// FLOWS PANEL
// ─────────────────────────────────────────────
function FlowsPanel({ t }) {
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
  const edges          = useStore(s => s.edges);

  const [name, setName]               = useState('');
  const [editingId, setEditingId]     = useState(null);
  const [editName, setEditName]       = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedLogs, setExpandedLogs]   = useState(null);

  const handleSave = () => {
    const n = name.trim() || currentFlow || 'Untitled Flow';
    saveFlow(n);
    setName('');
    toast.success(`Flow "${n}" saved`);
  };

  // Pre-activation validation
  const validateFlow = (flow) => {
    const errs = [];
    const triggerNodes = flow.nodes.filter(n => n.data?.nodeType === 'trigger');
    const actionNodes  = flow.nodes.filter(n => n.data?.nodeType === 'action');

    if (!flow.name || flow.name === 'Untitled Flow') errs.push('Give your flow a proper name before activating');
    if (triggerNodes.length === 0) errs.push('No trigger node — automation will never start');
    if (actionNodes.length === 0)  errs.push('No action node — automation does nothing');

    for (const n of triggerNodes) {
      const cfg = TEMPLATE_CONFIGS[n.data?.templateId];
      if (cfg?.required?.includes('board') && !n.data?.selectedBoardId)
        errs.push(`Trigger "${n.data?.label}": board not selected`);
    }
    for (const n of actionNodes) {
      const cfg = TEMPLATE_CONFIGS[n.data?.templateId];
      if (cfg?.required?.includes('board') && !n.data?.selectedBoardId)
        errs.push(`Action "${n.data?.label}": board not selected`);
    }

    const connectedIds = new Set([...flow.edges.map(e => e.source), ...flow.edges.map(e => e.target)]);
    const orphans = flow.nodes.filter(n => !connectedIds.has(n.id));
    if (orphans.length > 0) errs.push(`${orphans.length} node(s) are not connected`);

    return errs;
  };

  const handleToggleActive = async (flow) => {
    if (flow.active) {
      const result = await deactivateFlow(flow.id);
      if (result.success) toast.success(`"${flow.name}" deactivated`);
      else toast.error(`Deactivation failed: ${result.error}`);
    } else {
      // Validate before activating
      const errs = validateFlow(flow);
      if (errs.length > 0) {
        errs.forEach(e => toast.error(e, { duration: 4000 }));
        return;
      }
      toast.loading(`Activating "${flow.name}"...`, { id: 'activate' });
      const result = await activateFlow(flow.id);
      toast.dismiss('activate');
      if (result.success) {
        const wc = result.webhooks?.length || 0;
        toast.success(`"${flow.name}" is LIVE — ${wc} webhook${wc !== 1 ? 's' : ''} registered`);
        if (result.errors?.length) result.errors.forEach(e => toast(`⚠️ ${e}`, { icon: '⚠️' }));
      } else {
        toast.error(`Activation failed: ${result.error}`);
        if (result.errors) result.errors.forEach(e => toast.error(e));
      }
    }
  };

  const handleDelete = (flowId, flowName) => {
    if (confirmDelete === flowId) {
      deleteFlow(flowId);
      setConfirmDelete(null);
      toast.success(`"${flowName}" deleted`);
    } else {
      setConfirmDelete(flowId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  return (
    <div>
      <SectionLabel t={t}>Save Current Flow</SectionLabel>
      {nodes.length === 0 && (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8,
          padding: '10px 12px', marginBottom: 12, color: t.textMuted, fontSize: 11, lineHeight: 1.5 }}>
          ℹ️ Build your flow on the canvas first, then save it here.
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={currentFlow || 'Flow name...'}
          style={{
            flex: 1, background: t.bgCard, border: `1px solid ${t.border}`,
            borderRadius: 8, color: t.textPrimary, fontSize: 12, padding: '8px 10px',
            outline: 'none', fontFamily: '"DM Sans", sans-serif',
          }}
        />
        <button onClick={handleSave} disabled={nodes.length === 0} style={{
          background: nodes.length === 0 ? t.border : 'linear-gradient(135deg, #1f76c2, #6c63ff)',
          border: 'none', borderRadius: 8,
          color: nodes.length === 0 ? t.textMuted : '#fff',
          fontSize: 13, fontWeight: 700, padding: '8px 14px',
          cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
        }}>💾</button>
      </div>

      <SectionLabel t={t}>My Flows ({flows.length})</SectionLabel>
      {flows.length === 0 ? (
        <div style={{ color: t.textDim, fontSize: 12, textAlign: 'center', padding: '24px 0', lineHeight: 1.7 }}>
          No flows saved yet.<br />Build one and save it above.
        </div>
      ) : (
        flows.map(flow => (
          <FlowCard key={flow.id} flow={flow}
            isCurrent={flow.name === currentFlow}
            isEditing={editingId === flow.id}
            editName={editName}
            confirmDelete={confirmDelete}
            isActivating={activating === flow.id}
            showLogs={expandedLogs === flow.id}
            t={t}
            onLoad={() => loadFlow(flow)}
            onToggleActive={() => handleToggleActive(flow)}
            onDelete={() => handleDelete(flow.id, flow.name)}
            onStartRename={() => { setEditingId(flow.id); setEditName(flow.name); }}
            onRenameChange={setEditName}
            onRenameCommit={() => { if (editName.trim()) renameFlow(flow.id, editName.trim()); setEditingId(null); }}
            onRenameCancel={() => setEditingId(null)}
            onToggleLogs={() => setExpandedLogs(expandedLogs === flow.id ? null : flow.id)}
          />
        ))
      )}
    </div>
  );
}

function FlowCard({ flow, isCurrent, isEditing, editName, confirmDelete, isActivating, showLogs, t,
  onLoad, onToggleActive, onDelete, onStartRename, onRenameChange, onRenameCommit, onRenameCancel, onToggleLogs }) {
  const execLogs      = useStore(s => s.execLogs);
  const fetchExecLogs = useStore(s => s.fetchExecLogs);
  const isActive = flow.active;
  const logs     = execLogs[flow.id] || [];

  useEffect(() => {
    if (showLogs) fetchExecLogs(flow.id);
  }, [showLogs]); // eslint-disable-line

  const statusColor = (status) => {
    if (['action_success', 'completed', 'activated'].includes(status)) return '#00ca72';
    if (['action_error', 'error'].includes(status))                     return '#e2445c';
    if (status === 'condition_failed')                                  return '#fdab3d';
    return '#7eb8f7';
  };

  return (
    <div style={{
      background: isCurrent ? t.accent + '18' : t.bgCard,
      border: `1px solid ${isCurrent ? t.accent : t.border}`,
      borderRadius: 10, marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px' }}>
        <div onClick={onToggleActive} title={isActive ? 'Live — click to stop' : 'Inactive — click to activate'} style={{
          width: 8, height: 8, borderRadius: 50, flexShrink: 0,
          background: isActivating ? '#fdab3d' : isActive ? '#00ca72' : '#e2445c',
          cursor: 'pointer',
          boxShadow: isActivating ? '0 0 6px #fdab3d88' : isActive ? '0 0 6px #00ca7288' : '0 0 6px #e2445c88',
        }} />

        {isEditing ? (
          <input autoFocus value={editName} onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel(); }}
            onBlur={onRenameCommit}
            style={{
              flex: 1, background: t.bgInput, border: `1px solid ${t.accent}`,
              borderRadius: 5, color: t.textPrimary, fontSize: 12, fontWeight: 600,
              padding: '2px 6px', outline: 'none', fontFamily: '"DM Sans", sans-serif',
            }}
          />
        ) : (
          <div style={{ flex: 1, color: t.textPrimary, fontSize: 12, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {flow.name}
          </div>
        )}

        <span style={{
          background: isActive ? '#00ca7222' : '#e2445c22',
          color:      isActive ? '#00ca72'   : '#e2445c',
          border:     `1px solid ${isActive ? '#00ca7244' : '#e2445c44'}`,
          borderRadius: 99, fontSize: 9, fontWeight: 800,
          padding: '1px 7px', flexShrink: 0,
        }}>
          {isActivating ? '⏳' : isActive ? 'LIVE' : 'OFF'}
        </span>
      </div>

      {/* Meta */}
      <div style={{ padding: '0 12px 8px', color: t.textMuted, fontSize: 10 }}>
        {flow.nodes?.length || 0} nodes · {flow.edges?.length || 0} connections
        {flow.activatedAt && ` · Live since ${new Date(flow.activatedAt).toLocaleDateString()}`}
        {flow.webhookIds?.length > 0 && ` · ${flow.webhookIds.length} webhook${flow.webhookIds.length !== 1 ? 's' : ''}`}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', borderTop: `1px solid ${t.border}`, background: t.bgSidebar }}>
        <ActionBtn onClick={onLoad}       color="#7eb8f7" t={t}>📂 Load</ActionBtn>
        <ActionBtn onClick={onStartRename} color="#fdab3d" t={t}>✏️ Rename</ActionBtn>
        <ActionBtn onClick={onToggleActive} color={isActive ? '#e2445c' : '#00ca72'} t={t} disabled={isActivating}>
          {isActivating ? '⏳' : isActive ? '⏸ Stop' : '▶ Run'}
        </ActionBtn>
        <ActionBtn onClick={onToggleLogs} color="#6c63ff" t={t}>📋 Logs</ActionBtn>
        <ActionBtn onClick={onDelete} color="#e2445c" t={t} confirming={confirmDelete === flow.id}>
          {confirmDelete === flow.id ? '⚠️ Sure?' : '🗑'}
        </ActionBtn>
      </div>

      {/* Logs */}
      {showLogs && (
        <div style={{ borderTop: `1px solid ${t.border}`, maxHeight: 180, overflowY: 'auto', padding: '8px' }}>
          <div style={{ color: t.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>
            EXECUTION LOGS
          </div>
          {logs.length === 0 ? (
            <div style={{ color: t.textDim, fontSize: 11, textAlign: 'center', padding: '8px 0' }}>
              No executions yet. Activate the flow and trigger it in monday.com.
            </div>
          ) : (
            [...logs].reverse().map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, borderLeft: `2px solid ${statusColor(log.status)}`, paddingLeft: 7 }}>
                <div style={{ color: t.textDim, fontSize: 9, flexShrink: 0, marginTop: 1 }}>
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

function ActionBtn({ onClick, color, children, disabled, confirming, t }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, background: confirming ? color + '22' : hover ? color + '18' : 'transparent',
        border: 'none', borderRight: `1px solid ${t.border}`,
        color: disabled ? t.textDim : confirming ? color : hover ? color : t.textMuted,
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
function AuditPanel({ onAuditRequest, localWarnings, t }) {
  const auditResult  = useStore(s => s.auditResult);
  const auditLoading = useStore(s => s.auditLoading);
  const isPro        = useStore(s => s.isPro)();
  const nodes        = useStore(s => s.nodes);

  return (
    <div>
      <SectionLabel t={t}>Local Checks</SectionLabel>
      {localWarnings.length === 0 ? (
        <div style={{ color: t.success, fontSize: 12, marginBottom: 16 }}>✅ No basic issues found</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {localWarnings.map((w, i) => (
            <div key={i} style={{
              background: w.type === 'error' ? t.danger + '18' : w.type === 'warning' ? t.warning + '18' : t.accent + '18',
              border: `1px solid ${w.type === 'error' ? t.danger : w.type === 'warning' ? t.warning : t.accent}44`,
              borderRadius: 7, padding: '8px 10px', marginBottom: 6,
              color: w.type === 'error' ? t.danger : w.type === 'warning' ? t.warning : t.accent,
              fontSize: 11, lineHeight: 1.5,
            }}>
              {w.type === 'error' ? '🔴' : w.type === 'warning' ? '⚠️' : 'ℹ️'} {w.message}
            </div>
          ))}
        </div>
      )}

      <SectionLabel t={t}>AI Audit (Pro)</SectionLabel>
      {!isPro ? (
        <div style={{ background: t.accent2 + '18', border: `1px solid ${t.accent2}44`, borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
          <div style={{ color: t.textPrimary, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>AI Audit is a Pro feature</div>
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 16, lineHeight: 1.6 }}>
            Get intelligent recommendations, conflict detection, and improvement suggestions powered by Claude AI.
          </div>
          <button style={{
            background: `linear-gradient(135deg, ${t.accent2}, ${t.accent})`,
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 12, fontWeight: 700, padding: '10px 20px',
            cursor: 'pointer', boxShadow: `0 4px 16px ${t.accent2}44`,
          }}>✦ Upgrade to Pro — $8/mo</button>
        </div>
      ) : (
        <div>
          <button onClick={onAuditRequest} disabled={auditLoading || nodes.length === 0} style={{
            width: '100%', padding: '12px 0',
            background: nodes.length === 0 ? t.border : `linear-gradient(135deg, ${t.accent2}, ${t.accent})`,
            border: 'none', borderRadius: 10,
            color: nodes.length === 0 ? t.textMuted : '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: nodes.length > 0 ? `0 4px 18px ${t.accent2}44` : 'none',
            marginBottom: 14, transition: 'all 0.2s',
          }}>
            {auditLoading ? '🤖 Analyzing...' : '🤖 Run AI Audit'}
          </button>
          {auditResult && (
            <div style={{ background: t.accent2 + '18', border: `1px solid ${t.accent2}33`, borderRadius: 10, padding: '14px' }}>
              <div style={{ color: t.accent2, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: '0.06em' }}>🤖 AI ANALYSIS</div>
              <div style={{ color: t.textPrimary, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{auditResult}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, t }) {
  return (
    <div style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}