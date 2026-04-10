// src/utils/store.js
import { create } from 'zustand';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export const useStore = create((set, get) => ({
  // ── Auth ──
  token:   null,
  user:    null,
  setToken: token => set({ token }),
  setUser:  user  => set({ user }),
  logout:   () => {
    localStorage.removeItem('flowmap_token');
    set({ token: null, user: null, nodes: [], edges: [], auditResult: null });
  },

  // ── Plan ──
  plan:       'free',
  setPlan:    plan => set({ plan }),
  isPro:      () => ['pro', 'business'].includes(get().plan),
  isBusiness: () => get().plan === 'business',

  // ── Boards ──
  boards:    [],
  setBoards: boards => set({ boards }),

  // ── Flow canvas ──
  nodes:    [],
  edges:    [],
  setNodes: nodes => set({ nodes }),
  setEdges: edges => set({ edges }),

  updateNodeData: (nodeId, updates) => set(state => ({
    nodes: state.nodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ),
  })),

  deleteNode: (nodeId) => set(state => ({
    nodes: state.nodes.filter(n => n.id !== nodeId),
    edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
  })),

  // ── Drag template ──
  dragTemplate:    null,
  setDragTemplate: t => set({ dragTemplate: t }),

  // ── Current flow name ──
  currentFlowName:    'Untitled Flow',
  setCurrentFlowName: name => set({ currentFlowName: name }),

  // ── Saved flows ──
  savedFlows: JSON.parse(localStorage.getItem('flowmap_flows') || '[]'),

  saveFlow: (name) => {
    const { nodes, edges, savedFlows } = get();
    const existing = savedFlows.find(f => f.name === name);
    const newFlow  = {
      id:      existing?.id || `flow-${Date.now()}`,
      name,
      nodes,
      edges,
      active:  existing?.active  || false,
      savedAt: new Date().toISOString(),
    };
    const updated = existing
      ? savedFlows.map(f => f.id === newFlow.id ? newFlow : f)
      : [...savedFlows, newFlow];
    localStorage.setItem('flowmap_flows', JSON.stringify(updated));
    set({ savedFlows: updated, currentFlowName: name });
  },

  loadFlow: (flow) => set({
    nodes:           flow.nodes || [],
    edges:           flow.edges || [],
    currentFlowName: flow.name,
  }),

  deleteFlow: (flowId) => {
    const updated = get().savedFlows.filter(f => f.id !== flowId);
    localStorage.setItem('flowmap_flows', JSON.stringify(updated));
    set({ savedFlows: updated });
  },

  renameFlow: (flowId, newName) => {
    const updated = get().savedFlows.map(f =>
      f.id === flowId ? { ...f, name: newName } : f
    );
    localStorage.setItem('flowmap_flows', JSON.stringify(updated));
    set({ savedFlows: updated });
  },

  // ── ACTIVATE FLOW — registers real webhooks ──
  activateFlow: async (flowId) => {
    const { savedFlows, token } = get();
    const flow = savedFlows.find(f => f.id === flowId);
    if (!flow) return { success: false, error: 'Flow not found' };

    set({ activating: flowId });

    try {
      const res = await fetch(`${BACKEND_URL}/api/flows/activate`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ flow }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        set({ activating: null });
        return { success: false, error: data.error || 'Activation failed', errors: data.errors };
      }

      // Update the flow with webhook IDs and active status
      const updated = savedFlows.map(f =>
        f.id === flowId
          ? { ...f, active: true, webhookIds: data.webhooks, activatedAt: new Date().toISOString() }
          : f
      );
      localStorage.setItem('flowmap_flows', JSON.stringify(updated));
      set({ savedFlows: updated, activating: null });
      return { success: true, webhooks: data.webhooks, errors: data.errors };

    } catch (err) {
      set({ activating: null });
      return { success: false, error: err.message };
    }
  },

  // ── DEACTIVATE FLOW — removes webhooks ──
  deactivateFlow: async (flowId) => {
    const { savedFlows, token } = get();
    set({ activating: flowId });

    try {
      const res = await fetch(`${BACKEND_URL}/api/flows/deactivate`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ flowId }),
      });

      const data = await res.json();
      const updated = savedFlows.map(f =>
        f.id === flowId ? { ...f, active: false, webhookIds: null } : f
      );
      localStorage.setItem('flowmap_flows', JSON.stringify(updated));
      set({ savedFlows: updated, activating: null });
      return { success: true };

    } catch (err) {
      set({ activating: null });
      return { success: false, error: err.message };
    }
  },

  activating: null,

  // ── EXECUTION LOGS ──
  execLogs:    {},
  setExecLogs: (flowId, logs) => set(state => ({
    execLogs: { ...state.execLogs, [flowId]: logs },
  })),

  fetchExecLogs: async (flowId) => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/flows/${flowId}/logs`);
      const data = await res.json();
      get().setExecLogs(flowId, data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  },

  // ── AI Audit ──
  auditResult:     null,
  auditLoading:    false,
  setAuditResult:  r => set({ auditResult: r }),
  setAuditLoading: v => set({ auditLoading: v }),

  // ── UI ──
  activePanel:    'build',
  setActivePanel: p => set({ activePanel: p }),
}));
