// src/components/LoginScreen.jsx
// OAuth login screen shown when no token is present

import React, { useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // Redirect to backend which redirects to monday OAuth
    window.location.href = `${BACKEND_URL}/auth/monday`;
  };

  return (
    <div style={{
      width:          '100vw',
      height:         '100vh',
      background:     '#060d1a',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     '"DM Sans", sans-serif',
      position:       'relative',
      overflow:       'hidden',
    }}>
      {/* Ambient glow blobs */}
      <div style={{
        position:     'absolute',
        top:          '20%',
        left:         '30%',
        width:        400,
        height:       400,
        background:   'radial-gradient(circle, #1f76c222 0%, transparent 70%)',
        borderRadius: '50%',
        filter:       'blur(40px)',
        pointerEvents:'none',
      }} />
      <div style={{
        position:     'absolute',
        bottom:       '20%',
        right:        '25%',
        width:        300,
        height:       300,
        background:   'radial-gradient(circle, #6c63ff22 0%, transparent 70%)',
        borderRadius: '50%',
        filter:       'blur(40px)',
        pointerEvents:'none',
      }} />

      {/* Card */}
      <div style={{
        background:   '#0d1626',
        border:       '1px solid #1a3a5c',
        borderRadius: 24,
        padding:      '48px 56px',
        textAlign:    'center',
        maxWidth:     420,
        width:        '90%',
        boxShadow:    '0 24px 80px #00000088',
        position:     'relative',
        zIndex:       1,
      }}>
        {/* Logo */}
        <div style={{
          width:        72, height: 72,
          background:   'linear-gradient(135deg, #1f76c2 0%, #6c63ff 100%)',
          borderRadius: 20,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     36,
          margin:       '0 auto 24px',
          boxShadow:    '0 8px 32px #1f76c244',
        }}>🗺️</div>

        <h1 style={{
          color:         '#e8f0fe',
          fontSize:      32,
          fontWeight:    800,
          margin:        '0 0 8px',
          letterSpacing: '-0.03em',
        }}>FlowMap</h1>

        <p style={{
          color:      '#4a6080',
          fontSize:   14,
          margin:     '0 0 8px',
          lineHeight: 1.6,
        }}>
          Visual Automation Orchestrator
        </p>

        <p style={{
          color:      '#6a8099',
          fontSize:   13,
          margin:     '0 0 36px',
          lineHeight: 1.6,
        }}>
          See all your monday.com automations as a clear,<br />
          interactive flowchart — across every board.
        </p>

        {/* Feature bullets */}
        <div style={{ marginBottom: 36, textAlign: 'left' }}>
          {[
            ['⚡', 'Visualize triggers, conditions & actions'],
            ['🔗', 'Trace cross-board automation chains'],
            ['⚠️', 'Detect conflicts & redundancies'],
            ['🗺️', 'Interactive map with zoom & pan'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ color: '#8aabcc', fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width:        '100%',
            padding:      '16px 0',
            background:   loading
              ? '#1a2f4a'
              : 'linear-gradient(135deg, #1f76c2 0%, #6c63ff 100%)',
            color:        '#fff',
            border:       'none',
            borderRadius: 12,
            fontSize:     15,
            fontWeight:   700,
            cursor:       loading ? 'not-allowed' : 'pointer',
            boxShadow:    loading ? 'none' : '0 6px 24px #1f76c255',
            transition:   'all 0.2s',
            letterSpacing:'0.01em',
          }}
        >
          {loading ? '⏳ Connecting...' : '🔗 Connect with monday.com'}
        </button>

        <p style={{
          color:     '#2a4060',
          fontSize:  11,
          marginTop: 16,
        }}>
          Secure OAuth 2.0 · Read-only board access · No data stored
        </p>
      </div>
    </div>
  );
}
