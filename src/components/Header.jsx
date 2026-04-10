// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { useStore } from '../utils/store';

export default function Header() {
  const user            = useStore(s => s.user);
  const logout          = useStore(s => s.logout);
  const plan            = useStore(s => s.plan);
  const isPro           = useStore(s => s.isPro)();
  const currentFlowName = useStore(s => s.currentFlowName);
  const setFlowName     = useStore(s => s.setCurrentFlowName);
  const nodes           = useStore(s => s.nodes);
  const savedFlows      = useStore(s => s.savedFlows);
  const saveFlow        = useStore(s => s.saveFlow);
  const setActivePanel  = useStore(s => s.setActivePanel);

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName]       = useState('');
  const [unsaved, setUnsaved]         = useState(false);
  const [justSaved, setJustSaved]     = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [promptName, setPromptName]   = useState('');

  // Track unsaved changes — any time nodes change, mark as unsaved
  useEffect(() => {
    if (nodes.length > 0) setUnsaved(true);
  }, [nodes]);

  // ── Save handler ──
  const handleSave = () => {
    if (nodes.length === 0) return;

    // If flow has no name yet, show quick name prompt
    const isUntitled = !currentFlowName || currentFlowName === 'Untitled Flow';
    const existsAlready = savedFlows.find(f => f.name === currentFlowName);

    if (isUntitled && !existsAlready) {
      setPromptName('');
      setShowSavePrompt(true);
      return;
    }

    // Save directly
    commitSave(currentFlowName);
  };

  const commitSave = (name) => {
    const finalName = name.trim() || currentFlowName || 'Untitled Flow';
    saveFlow(finalName);
    setFlowName(finalName);
    setUnsaved(false);
    setShowSavePrompt(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  // ── Name edit ──
  const startEdit = () => { setTempName(currentFlowName); setEditingName(true); };
  const commitEdit = () => {
    if (tempName.trim()) setFlowName(tempName.trim());
    setEditingName(false);
    setUnsaved(true);
  };

  // ── Keyboard shortcut Ctrl+S ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, currentFlowName, savedFlows]); // eslint-disable-line

  const canSave = nodes.length > 0;

  return (
    <>
      <div style={{
        height: 52, background: '#080f1e', borderBottom: '1px solid #1a2f4a',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        fontFamily: '"DM Sans", sans-serif', flexShrink: 0, position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>🗺️</span>
          <span style={{ color: '#e8f0fe', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>FlowMap</span>
          <span style={{ color: '#2a4060', fontSize: 11 }}>v1.0</span>
        </div>

        <div style={{ color: '#1a2f4a', fontSize: 18, flexShrink: 0 }}>|</div>

        {/* Flow name (editable) */}
        {editingName ? (
          <input
            autoFocus
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            style={{
              background: '#0d1f33', border: '1px solid #1f76c2', borderRadius: 7,
              color: '#e8f0fe', fontSize: 13, fontWeight: 600, padding: '4px 10px',
              outline: 'none', fontFamily: '"DM Sans", sans-serif', minWidth: 160,
            }}
          />
        ) : (
          <button
            onClick={startEdit}
            title="Click to rename this flow"
            style={{
              background: 'none', border: '1px solid transparent', borderRadius: 7,
              color: '#7eb8f7', fontSize: 13, fontWeight: 600, padding: '4px 10px',
              cursor: 'pointer', fontFamily: '"DM Sans", sans-serif', display: 'flex',
              alignItems: 'center', gap: 6, flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1a3a5c'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            ✏️ {currentFlowName || 'Untitled Flow'}
            {/* Unsaved dot indicator */}
            {unsaved && canSave && (
              <span style={{
                width: 7, height: 7, borderRadius: 50,
                background: '#fdab3d',
                boxShadow: '0 0 6px #fdab3d88',
                flexShrink: 0,
              }} title="Unsaved changes" />
            )}
          </button>
        )}

        {/* Node count */}
        {nodes.length > 0 && (
          <span style={{ color: '#2a4060', fontSize: 11, flexShrink: 0 }}>
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* ── SAVE BUTTON ── */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          title={canSave ? 'Save flow (Ctrl+S)' : 'Add nodes to the canvas first'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: justSaved
              ? '#00ca7222'
              : canSave && unsaved
                ? 'linear-gradient(135deg, #1f76c2, #6c63ff)'
                : '#0d1626',
            border: `1px solid ${justSaved ? '#00ca7244' : canSave && unsaved ? 'transparent' : '#1a3a5c'}`,
            borderRadius: 8,
            color: justSaved ? '#00ca72' : canSave && unsaved ? '#fff' : '#2a4060',
            fontSize: 12, fontWeight: 700, padding: '6px 14px',
            cursor: canSave ? 'pointer' : 'not-allowed',
            boxShadow: canSave && unsaved && !justSaved ? '0 2px 12px #1f76c244' : 'none',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {justSaved ? '✅ Saved!' : '💾 Save'}
          {canSave && unsaved && !justSaved && (
            <span style={{
              background: '#ffffff33', borderRadius: 4,
              fontSize: 9, padding: '1px 5px', fontWeight: 600,
            }}>Ctrl+S</span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Flows shortcut button */}
        <button
          onClick={() => setActivePanel('flows')}
          title="View saved flows"
          style={{
            background: 'none', border: '1px solid #1a3a5c', borderRadius: 8,
            color: '#4a6080', fontSize: 12, fontWeight: 600, padding: '5px 12px',
            cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#7eb8f7'; e.currentTarget.style.borderColor = '#7eb8f7'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#4a6080'; e.currentTarget.style.borderColor = '#1a3a5c'; }}
        >
          📂 {savedFlows.length} Flow{savedFlows.length !== 1 ? 's' : ''}
        </button>

        {/* Plan badge */}
        <div style={{
          background: isPro ? '#0a0a1a' : '#0d1626',
          border: `1px solid ${isPro ? '#6c63ff44' : '#1a3a5c'}`,
          borderRadius: 99, padding: '3px 12px',
          color: isPro ? '#6c63ff' : '#4a6080',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', flexShrink: 0,
        }}>
          ✦ {plan.toUpperCase()}
        </div>

        {/* Upgrade */}
        {!isPro && (
          <button style={{
            background: 'linear-gradient(135deg, #6c63ff, #1f76c2)',
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 12, fontWeight: 700, padding: '6px 14px',
            cursor: 'pointer', boxShadow: '0 2px 12px #6c63ff44', flexShrink: 0,
          }}>
            ✦ Upgrade
          </button>
        )}

        {/* User avatar */}
        {user && (
          <div onClick={logout} title={`${user.name} · Click to log out`} style={{
            width: 32, height: 32, borderRadius: 50,
            overflow: 'hidden', border: '2px solid #1a3a5c',
            cursor: 'pointer', flexShrink: 0,
          }}>
            {user.photo_thumb
              ? <img src={user.photo_thumb} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #1f76c2, #6c63ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                }}>{user.name?.[0]?.toUpperCase() || '?'}</div>
            }
          </div>
        )}
      </div>

      {/* ── SAVE NAME PROMPT MODAL ── */}
      {showSavePrompt && (
        <div
          onClick={() => setShowSavePrompt(false)}
          style={{
            position: 'fixed', inset: 0, background: '#00000088',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, fontFamily: '"DM Sans", sans-serif',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0d1626', border: '1px solid #1a3a5c',
              borderRadius: 14, padding: '28px 32px', minWidth: 360,
              boxShadow: '0 24px 80px #00000099',
            }}
          >
            <div style={{ color: '#e8f0fe', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
              💾 Save Flow
            </div>
            <div style={{ color: '#4a6080', fontSize: 12, marginBottom: 20 }}>
              Give your automation flow a name so you can find it later.
            </div>
            <input
              autoFocus
              value={promptName}
              onChange={e => setPromptName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitSave(promptName); if (e.key === 'Escape') setShowSavePrompt(false); }}
              placeholder="e.g. Sales Pipeline, HR Onboarding..."
              style={{
                width: '100%', background: '#060d1a',
                border: '1px solid #1f76c2', borderRadius: 8,
                color: '#e8f0fe', fontSize: 13, padding: '10px 12px',
                outline: 'none', fontFamily: '"DM Sans", sans-serif',
                boxSizing: 'border-box', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSavePrompt(false)}
                style={{
                  background: 'none', border: '1px solid #1a3a5c', borderRadius: 8,
                  color: '#4a6080', fontSize: 12, fontWeight: 600,
                  padding: '8px 16px', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={() => commitSave(promptName)}
                disabled={!promptName.trim()}
                style={{
                  background: promptName.trim() ? 'linear-gradient(135deg, #1f76c2, #6c63ff)' : '#1a2f4a',
                  border: 'none', borderRadius: 8,
                  color: promptName.trim() ? '#fff' : '#3a5070',
                  fontSize: 12, fontWeight: 700, padding: '8px 20px',
                  cursor: promptName.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: promptName.trim() ? '0 4px 16px #1f76c244' : 'none',
                }}
              >💾 Save Flow</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}