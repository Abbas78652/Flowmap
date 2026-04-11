// src/components/LoginScreen.jsx
import React, { useState } from 'react';
import { useStore } from '../utils/store';
import { themes } from '../utils/theme';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function LoginScreen() {
  const theme    = useStore(s => s.theme);
  const t        = themes[theme];
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = `${BACKEND_URL}/auth/monday`;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"DM Sans", sans-serif', position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow blobs */}
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: 400, height: 400,
        background: 'radial-gradient(circle, #1f76c222 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '25%', width: 300, height: 300,
        background: 'radial-gradient(circle, #6c63ff22 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

      {/* Card */}
      <div style={{
        background: t.bgCard, border: `1px solid ${t.border}`,
        borderRadius: 24, padding: '48px 56px', textAlign: 'center',
        maxWidth: 420, width: '90%',
        boxShadow: `0 24px 80px ${t.nodeShadow}`,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 72, height: 72,
          background: 'linear-gradient(135deg, #1f76c2 0%, #6c63ff 100%)',
          borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px', boxShadow: '0 8px 32px #1f76c244',
        }}>🗺️</div>

        <h1 style={{ color: t.textPrimary, fontSize: 32, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
          FlowMap
        </h1>
        <p style={{ color: t.textMuted, fontSize: 14, margin: '0 0 8px', lineHeight: 1.6 }}>
          Visual Automation Builder
        </p>
        <p style={{ color: t.textMuted, fontSize: 13, margin: '0 0 36px', lineHeight: 1.6 }}>
          Build, visualize and execute your monday.com<br />automation flows with drag-and-drop simplicity.
        </p>

        <div style={{ marginBottom: 36, textAlign: 'left' }}>
          {[
            ['⚡', 'Build automation flows visually'],
            ['🔗', 'Execute real actions across boards'],
            ['🤖', 'AI-powered audit & recommendations'],
            ['🗺️', 'Interactive canvas with zoom & pan'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ color: t.textSecondary, fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>

        <button onClick={handleLogin} disabled={loading} style={{
          width: '100%', padding: '16px 0',
          background: loading ? t.border : 'linear-gradient(135deg, #1f76c2 0%, #6c63ff 100%)',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 6px 24px #1f76c255',
          transition: 'all 0.2s',
        }}>
          {loading ? '⏳ Connecting...' : '🔗 Connect with monday.com'}
        </button>

        <p style={{ color: t.textDim, fontSize: 11, marginTop: 16 }}>
          Secure OAuth 2.0 · No data stored without your consent
        </p>
      </div>
    </div>
  );
}