/* eslint-disable no-unused-vars */
// src/utils/store.js — Supabase-backed flow storage
import { create } from 'zustand';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Restore draft flow from localStorage on startup
const savedDraft = JSON.parse(localStorage.getItem('flowmap_draft') || 'null');

// ─────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────
async function apiFetch(path, options = {}, token) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return data;
}

export const useStore = create((set, get) => ({
  // ── Auth ──
  token:    null,
  user:     null,
  setToken: token => set({ token }),
  setUser:  user  => set({ user }),
  logout:   () => {
    localStorage.removeItem('flowmap_token');
    localStorage.removeItem('flowmap_draft');
    set({ token: null, user: null, nodes: [], edges: [], auditResult: null, savedFlows: [] });
  },

  // ── Theme ──
  theme: localStorage.getItem('flowmap_theme') || 'light',
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('flowmap_theme', next);
    set({ theme: next });
  },

  // ── Plan ──
  plan:       'free',
  setPlan:    plan => set({ plan }),
  isPro:      () => ['pro', 'business'].includes(get().plan),
  isBusiness: () => get().plan === 'business',

  // ── Workspaces ──
  workspaces:    [],
  setWorkspaces: workspaces => set({ workspaces }),

  // ── Workspace users ──
  workspaceUsers:    [],
  setWorkspaceUsers: users => set({ workspaceUsers: users }),

  // ── Boards ──
  boards:          [],
  boardsLoading:   false,
  setBoards:       boards => set({ boards }),
  setBoardsLoading: v => set({ boardsLoading: v }),

  // ── Flow canvas ──
  nodes:           savedDraft?.nodes || [],
  edges:           savedDraft?.edges || [],
  currentFlowName: savedDraft?.name  || 'Untitled Flow',

  setNodes: nodes => {
    set({ nodes });
    const { edges, currentFlowName } = get();
    localStorage.setItem('flowmap_draft', JSON.stringify({ nodes, edges, name: currentFlowName }));
  },
  setEdges: edges => {
    set({ edges });
    const { nodes, currentFlowName } = get();
    localStorage.setItem('flowmap_draft', JSON.stringify({ nodes, edges, name: currentFlowName }));
  },

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
  setCurrentFlowName: name => {
    set({ currentFlowName: name });
    const { nodes, edges } = get();
    localStorage.setItem('flowmap_draft', JSON.stringify({ nodes, edges, name }));
  },

  // ── Saved flows — Supabase backed ──
  savedFlows:      JSON.parse(localStorage.getItem('flowmap_flows') || '[]'),
  flowsLoading:    false,
  setFlowsLoading: v => set({ flowsLoading: v }),

  // Load flows from Supabase
  fetchFlows: async () => {
    const { token } = get();
    if (!token) return;
    set({ flowsLoading: true });
    try {
      const data = await apiFetch('/api/flows', {}, token);
      if (data.flows) {
        // Normalize Supabase flow format to match app format
        const flows = data.flows.map(f => ({
          id:          f.id,
          name:        f.name,
          nodes:       f.nodes || [],
          edges:       f.edges || [],
          active:      f.active || false,
          webhookIds:  f.webhook_ids || [],
          activatedAt: f.activated_at,
          savedAt:     f.updated_at,
        }));
        set({ savedFlows: flows });
        localStorage.setItem('flowmap_flows', JSON.stringify(flows));
      }
    } catch (err) {
      console.error('Failed to fetch flows:', err);
      // Fall back to localStorage
    } finally {
      set({ flowsLoading: false });
    }
  },

  saveFlow: async (name) => {
    const { nodes, edges, savedFlows, token } = get();
    const existing  = savedFlows.find(f => f.name === name);
    const newFlow   = {
      id:      existing?.id || `flow-${Date.now()}`,
      name,
      nodes,
      edges,
      active:  existing?.active  || false,
      savedAt: new Date().toISOString(),
    };

    // Optimistic update
    const updated = existing
      ? savedFlows.map(f => f.id === newFlow.id ? newFlow : f)
      : [...savedFlows, newFlow];
    localStorage.setItem('flowmap_flows', JSON.stringify(updated));
    set({ savedFlows: updated, currentFlowName: name });

    // Sync to Supabase
    if (token) {
      try {
        await apiFetch('/api/flows/save', {
          method: 'POST',
          body: JSON.stringify({ flow: newFlow }),
        }, token);
      } catch (err) {
        console.error('Supabase save failed:', err);
      }
    }
  },

  loadFlow: (flow) => {
    set({
      nodes:           flow.nodes || [],
      edges:           flow.edges || [],
      currentFlowName: flow.name,
    });
    localStorage.setItem('flowmap_draft', JSON.stringify({
      nodes: flow.nodes || [],
      edges: flow.edges || [],
      name:  flow.name,
    }));
  },

  deleteFlow: async (flowId) => {
    const { savedFlows, token } = get();
    const updated = savedFlows.filter(f => f.id !== flowId);
    localStorage.setItem('flowmap_flows', JSON.stringify(updated));
    set({ savedFlows: updated });
    if (token) {
      try {
        await apiFetch(`/api/flows/${flowId}`, { method: 'DELETE' }, token);
      } catch (err) {
        console.error('Supabase delete failed:', err);
      }
    }
  },

  renameFlow: async (flowId, newName) => {
    const { savedFlows, token } = get();
    const updated = savedFlows.map(f => f.id === flowId ? { ...f, name: newName } : f);
    localStorage.setItem('flowmap_flows', JSON.stringify(updated));
    set({ savedFlows: updated });
    // Save updated flow to Supabase
    const flow = updated.find(f => f.id === flowId);
    if (flow && token) {
      try {
        await apiFetch('/api/flows/save', {
          method: 'POST',
          body: JSON.stringify({ flow }),
        }, token);
      } catch (err) {
        console.error('Supabase rename failed:', err);
      }
    }
  },

  // ── ACTIVATE FLOW ──
  activateFlow: async (flowId) => {
    const { savedFlows, token } = get();
    const flow = savedFlows.find(f => f.id === flowId);
    if (!flow) return { success: false, error: 'Flow not found' };
    set({ activating: flowId });
    try {
      const data = await apiFetch('/api/flows/activate', {
        method: 'POST',
        body: JSON.stringify({ flow }),
      }, token);
      if (!data.success) {
        set({ activating: null });
        return { success: false, error: data.error || 'Activation failed', errors: data.errors };
      }
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

  // ── DEACTIVATE FLOW ──
  deactivateFlow: async (flowId) => {
    const { savedFlows, token } = get();
    set({ activating: flowId });
    try {
      const data = await apiFetch('/api/flows/deactivate', {
        method: 'POST',
        body: JSON.stringify({ flowId }),
      }, token);
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