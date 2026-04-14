/* eslint-disable react-hooks/exhaustive-deps */
// src/App.jsx

import React, { useEffect, useCallback, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import LoginScreen from './components/LoginScreen';
import Header      from './components/Header';
import Sidebar     from './components/Sidebar';
import FlowCanvas  from './components/FlowCanvas';

import { getCurrentUser, getBoards, getWorkspaces, getWorkspaceUsers } from './api/monday';
import { serializeFlowForAI }        from './utils/flowBuilder';
import { useStore }                  from './utils/store';
import { themes }                    from './utils/theme';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function App() {
  const token          = useStore(s => s.token);
  const setToken       = useStore(s => s.setToken);
  const setUser        = useStore(s => s.setUser);
  const setBoards          = useStore(s => s.setBoards);
  const setBoardsLoading   = useStore(s => s.setBoardsLoading);
  const setWorkspaces      = useStore(s => s.setWorkspaces);
  const setWorkspaceUsers  = useStore(s => s.setWorkspaceUsers);
  const fetchFlows         = useStore(s => s.fetchFlows);
  const nodes          = useStore(s => s.nodes);
  const edges          = useStore(s => s.edges);
  const currentFlow    = useStore(s => s.currentFlowName);
  const setAuditResult = useStore(s => s.setAuditResult);
  const setAuditLoading= useStore(s => s.setAuditLoading);
  const setActivePanel = useStore(s => s.setActivePanel);
  const theme          = useStore(s => s.theme);
  const t              = themes[theme];

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Parse token from URL
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      const stored = localStorage.getItem('flowmap_token');
      if (stored) setToken(stored);
    }
  }, []);

  // Load user + boards when token arrives
  useEffect(() => {
    if (!token) return;
    localStorage.setItem('flowmap_token', token);
    (async () => {
      try {
        setBoardsLoading(true);
        const [user, workspaces, users] = await Promise.all([
          getCurrentUser(token),
          getWorkspaces(token),
          getWorkspaceUsers(token),
        ]);
        setUser(user);
        setWorkspaces(workspaces);
        setWorkspaceUsers(users);
        // Fetch boards separately (paginated — may take longer)
        const boards = await getBoards(token);
        setBoards(boards);
        setBoardsLoading(false);
        // Load flows from Supabase
        fetchFlows();
        toast.success(`Welcome, ${user.name}! ${boards.length} boards across ${workspaces.length} workspaces loaded.`);
      } catch (err) {
        console.error(err);
        // Token expired — clear and force re-login
        if (err.message?.includes('401') || err.message?.includes('token')) {
          localStorage.removeItem('flowmap_token');
          setToken(null);
          toast.error('Session expired. Please reconnect.');
        } else {
          toast.error('Could not load boards. Check your connection.');
        }
      }
    })();
  }, [token]);

  // AI Audit
  const handleAudit = useCallback(async () => {
    if (nodes.length === 0) { toast.error('Add some nodes to your flow first!'); return; }
    setAuditLoading(true);
    setActivePanel('audit');

    const flowText = serializeFlowForAI(nodes, edges, currentFlow);
    const prompt   = `You are an expert monday.com automation consultant. A user has built the following automation flow and wants your professional audit.

${flowText}

Please provide:
1. ✅ WHAT'S GOOD — Strengths of this automation design (2-3 points)
2. ⚠️ POTENTIAL ISSUES — Problems, gaps, or risks (be specific)
3. 💡 RECOMMENDATIONS — Concrete improvements they should make
4. 🔄 MISSING STEPS — Any triggers, conditions, or actions that are missing for reliability
5. ⭐ OVERALL SCORE — Rate this flow /10 and explain why

Be specific to monday.com. Use practical, actionable language. Keep total response under 400 words.`;

    try {
      const res  = await fetch(`${BACKEND_URL}/api/audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setAuditResult(data.result || 'No response received.');
      toast.success('AI Audit complete!');
    } catch (err) {
      toast.error('AI Audit failed. Check your connection.');
      setAuditResult('Audit failed. Please try again.');
    } finally {
      setAuditLoading(false);
    }
  }, [nodes, edges, currentFlow]);

  if (!token) return <LoginScreen />;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: t.bg, overflow: 'hidden',
    }}>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background:  t.bgCard,
            color:       t.textPrimary,
            border:      `1px solid ${t.border}`,
            fontFamily:  '"DM Sans", sans-serif',
            fontSize:    13,
            boxShadow:   `0 4px 20px ${t.nodeShadow}`,
          },
          success: { iconTheme: { primary: t.success, secondary: t.bgCard } },
          error:   { iconTheme: { primary: t.danger,  secondary: t.bgCard } },
        }}
      />

      <Header />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          onAuditRequest={handleAudit}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FlowCanvas onAudit={handleAudit} />
        </div>
      </div>
    </div>
  );
}