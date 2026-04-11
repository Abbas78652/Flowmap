// src/components/SearchableSelect.jsx
// Searchable dropdown for 300+ boards/columns

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../utils/store';
import { themes } from '../utils/theme';

export default function SearchableSelect({ value, onChange, options, placeholder, color }) {
  const theme       = useStore(s => s.theme);
  const t           = themes[theme];
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find(o => o.value === value);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 5 }} onClick={e => e.stopPropagation()}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: t.bgInput,
          border: `1px solid ${open ? color : color + '44'}`,
          borderRadius: 6, color: selected ? t.textPrimary : t.textMuted,
          fontSize: 11, padding: '6px 10px', outline: 'none',
          fontFamily: '"DM Sans", sans-serif', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textAlign: 'left', boxSizing: 'border-box',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ color: t.textMuted, fontSize: 10, marginLeft: 6, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown — uses portal-style positioning to escape React Flow z-index */}
      {open && (
        <div style={{
          position:   'absolute',
          top:        '100%',
          left:       0,
          right:      0,
          zIndex:     999999,
          background: t.bgCard,
          border:     `1px solid ${color}44`,
          borderRadius: 8,
          marginTop:  3,
          boxShadow:  '0 12px 40px #00000055',
          overflow:   'hidden',
          isolation:  'isolate',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 8px 4px', background: t.bgCard }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${options.length} options...`}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', background: t.bgInput,
                border: `1px solid ${color}33`, borderRadius: 5,
                color: t.textPrimary, fontSize: 11, padding: '6px 10px',
                outline: 'none', fontFamily: '"DM Sans", sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {/* Clear option */}
            {value && (
              <div
                onClick={() => handleSelect({ value: '', label: '' })}
                style={{
                  padding: '7px 10px', cursor: 'pointer',
                  color: t.danger, fontSize: 11,
                  borderBottom: `1px solid ${t.border}`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                ✕ Clear selection
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{ padding: '12px 10px', color: t.textMuted, fontSize: 11, textAlign: 'center' }}>
                No results for "{search}"
              </div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  style={{
                    padding: '7px 10px', cursor: 'pointer',
                    color: opt.value === value ? color : t.textPrimary,
                    fontSize: 11, lineHeight: 1.4,
                    background: opt.value === value ? color + '18' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = t.bgHover; }}
                  onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
                >
                  {opt.value === value && <span style={{ color, fontSize: 10, flexShrink: 0 }}>✓</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Count footer */}
          <div style={{
            padding: '4px 10px', background: t.bgInput,
            borderTop: `1px solid ${t.border}`,
            color: t.textMuted, fontSize: 10, textAlign: 'right',
          }}>
            {filtered.length} of {options.length}
          </div>
        </div>
      )}
    </div>
  );
}