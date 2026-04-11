/* eslint-disable react-hooks/exhaustive-deps */
// src/components/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../utils/store';
import { themes } from '../utils/theme';

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
  const theme           = useStore(s => s.theme);
  const toggleTheme     = useStore(s => s.toggleTheme);
  const t               = themes[theme];

  const [editingName, setEditingName]     = useState(false);
  const [tempName, setTempName]           = useState('');
  const [unsaved, setUnsaved]             = useState(false);
  const [justSaved, setJustSaved]         = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [promptName, setPromptName]       = useState('');

  useEffect(() => {
    if (nodes.length > 0) setUnsaved(true);
  }, [nodes]);

  const handleSave = () => {
    if (nodes.length === 0) return;
    const isUntitled    = !currentFlowName || currentFlowName === 'Untitled Flow';
    const existsAlready = savedFlows.find(f => f.name === currentFlowName);
    if (isUntitled && !existsAlready) {
      setPromptName('');
      setShowSavePrompt(true);
      return;
    }
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

  const startEdit = () => { setTempName(currentFlowName); setEditingName(true); };
  const commitEdit = () => {
    if (tempName.trim()) setFlowName(tempName.trim());
    setEditingName(false);
    setUnsaved(true);
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, currentFlowName, savedFlows]);

  const canSave = nodes.length > 0;
  const isLight = theme === 'light';

  return (
    <>
      <div style={{
        height: 52, background: t.bgSidebar,
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        fontFamily: '"DM Sans", sans-serif', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>🗺️</span>
          <span style={{ color: t.textPrimary, fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>FlowMap</span>
          <span style={{ color: t.textDim, fontSize: 11 }}>v1.0</span>
        </div>

        <div style={{ color: t.border, fontSize: 18, flexShrink: 0 }}>|</div>

        {/* Flow name */}
        {editingName ? (
          <input autoFocus value={tempName}
            onChange={e => setTempName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            style={{
              background: t.bgInput, border: `1px solid ${t.accent}`, borderRadius: 7,
              color: t.textPrimary, fontSize: 13, fontWeight: 600, padding: '4px 10px',
              outline: 'none', fontFamily: '"DM Sans", sans-serif', minWidth: 160,
            }}
          />
        ) : (
          <button onClick={startEdit} style={{
            background: 'none', border: `1px solid transparent`, borderRadius: 7,
            color: t.textSecondary, fontSize: 13, fontWeight: 600, padding: '4px 10px',
            cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderLight}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            ✏️ {currentFlowName || 'Untitled Flow'}
            {unsaved && canSave && (
              <span style={{ width: 7, height: 7, borderRadius: 50, background: t.warning, flexShrink: 0 }} />
            )}
          </button>
        )}

        {nodes.length > 0 && (
          <span style={{ color: t.textMuted, fontSize: 11, flexShrink: 0 }}>
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Save button */}
        <button onClick={handleSave} disabled={!canSave} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: justSaved ? t.success + '22'
            : canSave && unsaved ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})`
            : t.bgButton,
          border: `1px solid ${justSaved ? t.success + '44' : canSave && unsaved ? 'transparent' : t.border}`,
          borderRadius: 8,
          color: justSaved ? t.success : canSave && unsaved ? '#fff' : t.textMuted,
          fontSize: 12, fontWeight: 700, padding: '6px 14px',
          cursor: canSave ? 'pointer' : 'not-allowed',
          boxShadow: canSave && unsaved && !justSaved ? `0 2px 12px ${t.accent}44` : 'none',
          transition: 'all 0.2s', flexShrink: 0,
        }}>
          {justSaved ? '✅ Saved!' : '💾 Save'}
          {canSave && unsaved && !justSaved && (
            <span style={{ background: '#ffffff33', borderRadius: 4, fontSize: 9, padding: '1px 5px', fontWeight: 600 }}>
              Ctrl+S
            </span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Flows shortcut */}
        <button onClick={() => setActivePanel('flows')} style={{
          background: 'none', border: `1px solid ${t.border}`, borderRadius: 8,
          color: t.textMuted, fontSize: 12, fontWeight: 600, padding: '5px 12px',
          cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
          onMouseEnter={e => { e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.borderColor = t.textSecondary; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.textMuted;     e.currentTarget.style.borderColor = t.border; }}
        >
          📂 {savedFlows.length} Flow{savedFlows.length !== 1 ? 's' : ''}
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={`Switch to ${isLight ? 'dark' : 'light'} mode`} style={{
          background: t.bgButton, border: `1px solid ${t.border}`, borderRadius: 8,
          color: t.textMuted, fontSize: 16, padding: '5px 10px',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {isLight ? '🌙' : '☀️'}
        </button>

        {/* Plan badge */}
        <div style={{
          background: isPro ? t.accent2 + '22' : t.bgButton,
          border: `1px solid ${isPro ? t.accent2 + '44' : t.border}`,
          borderRadius: 99, padding: '3px 12px',
          color: isPro ? t.accent2 : t.textMuted,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', flexShrink: 0,
        }}>
          ✦ {plan.toUpperCase()}
        </div>

        {/* Upgrade */}
        {!isPro && (
          <button style={{
            background: `linear-gradient(135deg, ${t.accent2}, ${t.accent})`,
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 12, fontWeight: 700, padding: '6px 14px',
            cursor: 'pointer', flexShrink: 0,
          }}>✦ Upgrade</button>
        )}

        {/* User avatar with dropdown */}
        {user && <UserMenu user={user} logout={logout} t={t} />}
      </div>

      {/* Save name prompt modal */}
      {showSavePrompt && (
        <div onClick={() => setShowSavePrompt(false)} style={{
          position: 'fixed', inset: 0, background: '#00000066',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, fontFamily: '"DM Sans", sans-serif',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.bgCard, border: `1px solid ${t.border}`,
            borderRadius: 14, padding: '28px 32px', minWidth: 360,
            boxShadow: '0 24px 80px #00000044',
          }}>
            <div style={{ color: t.textPrimary, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>💾 Save Flow</div>
            <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 20 }}>Give your automation flow a name.</div>
            <input autoFocus value={promptName}
              onChange={e => setPromptName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitSave(promptName); if (e.key === 'Escape') setShowSavePrompt(false); }}
              placeholder="e.g. Sales Pipeline, HR Onboarding..."
              style={{
                width: '100%', background: t.bgInput,
                border: `1px solid ${t.accent}`, borderRadius: 8,
                color: t.textPrimary, fontSize: 13, padding: '10px 12px',
                outline: 'none', fontFamily: '"DM Sans", sans-serif',
                boxSizing: 'border-box', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSavePrompt(false)} style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: 8,
                color: t.textMuted, fontSize: 12, fontWeight: 600,
                padding: '8px 16px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => commitSave(promptName)} disabled={!promptName.trim()} style={{
                background: promptName.trim() ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : t.border,
                border: 'none', borderRadius: 8,
                color: promptName.trim() ? '#fff' : t.textMuted,
                fontSize: 12, fontWeight: 700, padding: '8px 20px',
                cursor: promptName.trim() ? 'pointer' : 'not-allowed',
              }}>💾 Save Flow</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// USER MENU — avatar + dropdown with confirmation
// ─────────────────────────────────────────────
function UserMenu({ user, logout, t }) {
  const [open, setOpen]             = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setConfirmLogout(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    if (confirmLogout) {
      logout();
    } else {
      setConfirmLogout(true);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Avatar button */}
      <button
        onClick={() => { setOpen(o => !o); setConfirmLogout(false); }}
        style={{
          width: 34, height: 34, borderRadius: 50,
          overflow: 'hidden',
          border: `2px solid ${open ? t.accent : t.border}`,
          cursor: 'pointer', flexShrink: 0,
          padding: 0, background: 'none',
          transition: 'border-color 0.15s',
          boxShadow: open ? `0 0 0 3px ${t.accent}33` : 'none',
        }}
      >
        {user.photo_thumb
          ? <img src={user.photo_thumb} alt={user.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              {user.name?.[0]?.toUpperCase() || '?'}
            </div>
        }
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:     'absolute',
          top:          'calc(100% + 10px)',
          right:        0,
          minWidth:     220,
          background:   t.bgCard,
          border:       `1px solid ${t.border}`,
          borderRadius: 12,
          boxShadow:    `0 8px 32px ${t.nodeShadow}`,
          zIndex:       9999,
          overflow:     'hidden',
          fontFamily:   '"DM Sans", sans-serif',
        }}>
          {/* User info header */}
          <div style={{
            padding:      '14px 16px',
            borderBottom: `1px solid ${t.border}`,
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            {/* Avatar (larger) */}
            <div style={{
              width: 42, height: 42, borderRadius: 50, overflow: 'hidden',
              border: `2px solid ${t.border}`, flexShrink: 0,
            }}>
              {user.photo_thumb
                ? <img src={user.photo_thumb} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{
                    width: '100%', height: '100%',
                    background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 18,
                  }}>{user.name?.[0]?.toUpperCase() || '?'}</div>
              }
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: t.textPrimary, fontWeight: 700, fontSize: 13,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{user.name}</div>
              <div style={{
                color: t.textMuted, fontSize: 11, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{user.email}</div>
              {user.account?.name && (
                <div style={{
                  color: t.accent, fontSize: 10, marginTop: 3, fontWeight: 600,
                }}>🏢 {user.account.name}</div>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px 0' }}>
            <MenuItem icon="⚙️" label="Account Settings" color={t.textPrimary} t={t}
              onClick={() => { window.open('https://monday.com/account', '_blank'); setOpen(false); }} />
            <MenuItem icon="📖" label="FlowMap Documentation" color={t.textPrimary} t={t}
              onClick={() => { window.open('https://github.com/Abbas78652/Flowmap', '_blank'); setOpen(false); }} />
            <MenuItem icon="💬" label="Send Feedback" color={t.textPrimary} t={t}
              onClick={() => { window.open('mailto:support@flowmap.app', '_blank'); setOpen(false); }} />
          </div>

          {/* Logout section */}
          <div style={{ borderTop: `1px solid ${t.border}`, padding: '6px 0 8px' }}>
            {confirmLogout ? (
              <div style={{ padding: '8px 16px' }}>
                <div style={{ color: t.danger, fontSize: 11, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                  Are you sure you want to log out?
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setConfirmLogout(false)}
                    style={{
                      flex: 1, background: t.bgInput,
                      border: `1px solid ${t.border}`, borderRadius: 7,
                      color: t.textMuted, fontSize: 12, fontWeight: 600,
                      padding: '7px 0', cursor: 'pointer',
                      fontFamily: '"DM Sans", sans-serif',
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleLogout}
                    style={{
                      flex: 1, background: t.danger,
                      border: 'none', borderRadius: 7,
                      color: '#fff', fontSize: 12, fontWeight: 700,
                      padding: '7px 0', cursor: 'pointer',
                      fontFamily: '"DM Sans", sans-serif',
                    }}
                  >Log Out</button>
                </div>
              </div>
            ) : (
              <MenuItem icon="🚪" label="Log Out" color={t.danger} t={t} onClick={handleLogout} danger />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, color, t, onClick, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', background: hover ? (danger ? t.danger + '18' : t.bgHover) : 'transparent',
        border: 'none', padding: '9px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: '"DM Sans", sans-serif', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: hover && danger ? t.danger : color, fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}