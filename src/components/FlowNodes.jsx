// src/components/FlowNodes.jsx
// Full theme-aware nodes with template-specific fields, token insertion, validation

import React, { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import SearchableSelect from './SearchableSelect';
import { themes } from '../utils/theme';
import { useStore } from '../utils/store';

// ─────────────────────────────────────────────
// TEMPLATE CONFIG MAP
// ─────────────────────────────────────────────
export const TEMPLATE_CONFIGS = {
  // TRIGGERS
  status_changed:   { notes: 'Fires when a status column changes to a specific value.', fields: ['board', 'column:status', 'value:status'], required: ['board', 'column', 'value'] },
  item_created:     { notes: 'Fires when any new item is created in the selected board.', fields: ['board'], required: ['board'] },
  date_arrives:     { notes: 'Fires when a date column reaches today or a set offset (e.g. today+3).', fields: ['board', 'column:date|timeline', 'date_offset'], required: ['board', 'column'] },
  column_changes:   { notes: 'Fires when any value in the selected column changes.', fields: ['board', 'column:text|numbers|dropdown|checkbox|rating'], required: ['board', 'column'] },
  item_assigned:    { notes: 'Fires when a people column is changed — item assigned to someone.', fields: ['board', 'column:people|team'], required: ['board'] },
  subitem_created:  { notes: 'Fires when a subitem is added to any item in the selected board.', fields: ['board'], required: ['board'] },
  button_clicked:   { notes: 'Fires when a button column is clicked by a user.', fields: ['board', 'column:button'], required: ['board'] },
  recurring_time:   { notes: 'Fires on a recurring schedule — daily, weekly, or monthly.', fields: ['board', 'recurrence'], required: ['board', 'recurrence'] },
  item_moved:       { notes: 'Fires when an item is moved into a specific group.', fields: ['board', 'group'], required: ['board', 'group'] },
  dependency_met:   { notes: 'Fires when all dependent items linked to this item are marked done.', fields: ['board', 'column:dependency'], required: ['board'] },
  // CONDITIONS
  status_is:        { notes: 'Only continues if the status column equals the selected value.', fields: ['board', 'column:status', 'value:status'], required: ['board', 'column', 'value'] },
  person_is:        { notes: 'Only continues if the people column matches the specified person.', fields: ['board', 'column:people|team', 'value:text'], required: ['board', 'column', 'value'] },
  group_is:         { notes: 'Only continues if the item currently belongs to the selected group.', fields: ['board', 'group'], required: ['board', 'group'] },
  column_contains:  { notes: 'Only continues if the text column contains the specified word or phrase.', fields: ['board', 'column:text|long_text|email|phone|link', 'value:text'], required: ['board', 'column', 'value'] },
  number_greater:   { notes: 'Only continues if the number column value is greater than the number specified.', fields: ['board', 'column:numbers|rating', 'value:number'], required: ['board', 'column', 'value'] },
  date_is_past:     { notes: 'Only continues if the selected date column has already passed.', fields: ['board', 'column:date|timeline'], required: ['board', 'column'] },
  checkbox_checked: { notes: 'Only continues if the selected checkbox column is ticked.', fields: ['board', 'column:checkbox'], required: ['board', 'column'] },
  no_condition:     { notes: 'No condition — the action runs every time the trigger fires without filtering.', fields: [], required: [] },
  // ACTIONS
  notify_someone:   { notes: 'Sends a monday.com in-app notification to the selected person with your message.', fields: ['board', 'person_picker', 'rich:message'], required: ['board'] },
  send_email:       { notes: 'Sends an email via Mailjet. Enter recipient email, subject and message body.', fields: ['email_to', 'rich:email_subject', 'rich:message'], required: ['email_to', 'email_subject', 'message'] },
  create_item:      { notes: 'Creates a new item in the target board and group with the specified name.', fields: ['board', 'group', 'rich:item_name'], required: ['board', 'item_name'] },
  move_item:        { notes: 'Moves the triggering item into a different group.', fields: ['board', 'group'], required: ['board', 'group'] },
  set_status:       { notes: 'Changes a status column to the selected value on the triggering item.', fields: ['board', 'column:status', 'value:status'], required: ['board', 'column', 'value'] },
  assign_person:    { notes: 'Sets the people column to a specific person on the triggering item.', fields: ['board', 'column:people|team', 'person_picker'], required: ['board', 'column'] },
  set_date:         { notes: 'Sets a date column to today or a calculated offset (e.g. today+7).', fields: ['board', 'column:date|timeline', 'date_offset'], required: ['board', 'column'] },
  create_subitem:   { notes: 'Adds a subitem to the triggering item with the specified name.', fields: ['board', 'rich:item_name'], required: ['board'] },
  duplicate_item:   { notes: 'Creates an exact copy of the triggering item in the same or another board.', fields: ['board', 'group'], required: ['board'] },
  archive_item:     { notes: 'Archives the triggering item — it will no longer appear in the active board.', fields: ['board'], required: ['board'] },
  create_update:    { notes: 'Posts a message in the updates section of the triggering item.', fields: ['rich:message'], required: ['message'] },
  connect_boards:   { notes: 'Links the triggering item to an item in another board via a board relation column.', fields: ['board', 'column:board_relation'], required: ['board', 'column'] },
};

// ─────────────────────────────────────────────
// DYNAMIC TOKENS
// ─────────────────────────────────────────────
const STATIC_TOKENS = [
  { key: '{Item Name}',    label: 'Item Name',     category: 'Item'  },
  { key: '{Item ID}',      label: 'Item ID',       category: 'Item'  },
  { key: '{Board Name}',   label: 'Board Name',    category: 'Board' },
  { key: '{Group Name}',   label: 'Group Name',    category: 'Board' },
  { key: '{Today}',        label: "Today's Date",  category: 'Date'  },
  { key: '{Triggered By}', label: 'Triggered By',  category: 'User'  },
];

function buildTokensFromBoard(board) {
  if (!board) return STATIC_TOKENS;
  const colTokens = (board.columns || []).map(c => ({
    key:      `{${c.title}}`,
    label:    c.title,
    category: `Column (${c.type})`,
    type:     c.type,
  }));
  return [...STATIC_TOKENS, ...colTokens];
}

// ─────────────────────────────────────────────
// RICH TEXT FIELD — theme-aware
// ─────────────────────────────────────────────
function RichTextField({ value, onChange, placeholder, color, label, tokens, t }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = tokens.filter(tok =>
    tok.label.toLowerCase().includes(search.toLowerCase()) ||
    tok.category.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, tok) => {
    if (!acc[tok.category]) acc[tok.category] = [];
    acc[tok.category].push(tok);
    return acc;
  }, {});

  // Insert at cursor position
  const inputRef = useRef(null);
  const insertToken = (token) => {
    const el    = inputRef.current;
    const start = el ? el.selectionStart : (value || '').length;
    const end   = el ? el.selectionEnd   : (value || '').length;
    const text  = (value || '');
    const next  = text.slice(0, start) + token.key + text.slice(end);
    onChange(next);
    setOpen(false);
    setSearch('');
    setTimeout(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(start + token.key.length, start + token.key.length);
      }
    }, 0);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <FieldLabel text={label} color={color} />
      <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
        <input
          ref={inputRef}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, background: t.bgInput,
            border: `1px solid ${color}44`, borderRadius: 6,
            color: t.textPrimary, fontSize: 10, padding: '5px 8px',
            outline: 'none', fontFamily: '"DM Sans", sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={e => { e.stopPropagation(); setOpen(o => !o); setSearch(''); }}
          title="Insert dynamic value"
          style={{
            background:   open ? color + '33' : t.bgButton,
            border:       `1px solid ${color}44`,
            borderRadius: 6, color, fontSize: 11, fontWeight: 800,
            padding: '0 8px', cursor: 'pointer', flexShrink: 0,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >{'{+}'}</button>
      </div>

      {/* Token pills */}
      {value && value.includes('{') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {(value.match(/\{[^}]+\}/g) || []).map((tok, i) => (
            <span key={i} style={{
              background: color + '22', border: `1px solid ${color}44`,
              borderRadius: 99, color, fontSize: 9, fontWeight: 700, padding: '1px 6px',
            }}>{tok}</span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 99999, background: t.bgCard,
          border: `1px solid ${color}44`, borderRadius: 8,
          marginTop: 4, boxShadow: '0 8px 32px #00000033',
          maxHeight: 220, overflowY: 'auto',
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              autoFocus value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search fields..."
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', background: t.bgInput,
                border: `1px solid ${color}33`, borderRadius: 5,
                color: t.textPrimary, fontSize: 10, padding: '4px 8px',
                outline: 'none', fontFamily: '"DM Sans", sans-serif', boxSizing: 'border-box',
              }}
            />
          </div>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{
                color: t.textDim, fontSize: 9, fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '6px 10px 3px',
              }}>{category}</div>
              {items.map(tok => (
                <div key={tok.key} onClick={() => insertToken(tok)} style={{
                  padding: '6px 10px', cursor: 'pointer',
                  color: t.textPrimary, fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    background: color + '22', color, borderRadius: 4,
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', flexShrink: 0,
                  }}>{tok.key}</span>
                  <span style={{ color: t.textSecondary }}>{tok.label}</span>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div style={{ padding: '12px', color: t.textMuted, fontSize: 11, textAlign: 'center' }}>
              No fields match "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BASE COMPONENTS — all theme-aware
// ─────────────────────────────────────────────
function NodeInput({ value, onChange, placeholder, color, t, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', background: t.bgInput,
        border: `1px solid ${color}33`, borderRadius: 6,
        color: t.textPrimary, fontSize: 10, padding: '5px 8px',
        outline: 'none', fontFamily: '"DM Sans", sans-serif',
        marginTop: 5, boxSizing: 'border-box',
      }}
    />
  );
}

function FieldLabel({ text, color, required }) {
  return (
    <div style={{
      color: color + 'bb', fontSize: 9, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      marginTop: 8, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {text}
      {required && <span style={{ color: '#e2445c', fontSize: 9 }}>*</span>}
    </div>
  );
}

function TypeBadge({ label, color }) {
  return (
    <span style={{
      background: color + '22', color,
      border: `1px solid ${color}44`, borderRadius: 99,
      fontSize: 9, fontWeight: 800, padding: '2px 8px',
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{label}</span>
  );
}

function GroupBadge({ groupNumber, color }) {
  return (
    <span style={{
      background: color + '11', color,
      border: `1px solid ${color}44`, borderRadius: 99,
      fontSize: 9, fontWeight: 800, padding: '2px 8px',
      letterSpacing: '0.06em', marginLeft: 4,
    }}>Automation #{groupNumber}</span>
  );
}

// Validation indicator
function ValidationDot({ isValid }) {
  return (
    <div title={isValid ? 'Ready' : 'Required fields missing'} style={{
      width: 7, height: 7, borderRadius: 50, flexShrink: 0,
      background: isValid ? '#00ca72' : '#e2445c',
      boxShadow:  isValid ? '0 0 5px #00ca7288' : '0 0 5px #e2445c88',
    }} />
  );
}

function NodeShell({ data, selected, children, sourceHandle = true, targetHandle = true, isValid, t }) {
  const deleteNode = useStore(s => s.deleteNode);
  return (
    <div style={{
      background:   t.nodeBg,
      border:       `2px solid ${selected ? data.color : data.color + '55'}`,
      borderRadius: 14, minWidth: 270, maxWidth: 320,
      boxShadow:    selected
        ? `0 0 20px ${data.color}44, 0 8px 32px ${t.nodeShadow}`
        : `0 4px 16px ${t.nodeShadow}`,
      transition: 'all 0.15s ease',
      fontFamily: '"DM Sans", sans-serif', position: 'relative',
    }}>
      {targetHandle && (
        <Handle type="target" position={Position.Left}
          style={{ background: data.color, width: 10, height: 10, border: `2px solid ${t.nodeBg}` }} />
      )}
      {sourceHandle && (
        <Handle type="source" position={Position.Right}
          style={{ background: data.color, width: 10, height: 10, border: `2px solid ${t.nodeBg}` }} />
      )}
      {/* Validation dot — top right inside card, doesn't overlap handles */}
      {isValid !== undefined && (
        <div style={{ position: 'absolute', top: 8, right: selected ? 20 : 8 }}>
          <ValidationDot isValid={isValid} />
        </div>
      )}
      {selected && (
        <button onClick={e => { e.stopPropagation(); deleteNode(data.id); }} style={{
          position: 'absolute', top: -10, right: -10,
          width: 22, height: 22, background: '#e2445c',
          border: 'none', borderRadius: 50, color: '#fff',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// DATA HOOKS
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// WORKSPACE HOOKS
// ─────────────────────────────────────────────
function useWorkspaceOptions() {
  const workspaces = useStore(s => s.workspaces);
  const boards     = useStore(s => s.boards);
  return useMemo(() => {
    // Use dedicated workspaces list if available
    if (workspaces && workspaces.length > 0) {
      return [
        { value: '__all__', label: '🌐 All Workspaces' },
        ...workspaces.map(ws => ({ value: ws.id, label: ws.name })),
      ];
    }
    // Fallback: derive from boards
    const seen = new Map();
    boards.forEach(b => {
      const ws = b.workspace;
      if (ws?.id && ws?.name && !seen.has(ws.id)) {
        seen.set(ws.id, { value: ws.id, label: ws.name });
      }
    });
    return [{ value: '__all__', label: '🌐 All Workspaces' }, ...Array.from(seen.values())];
  }, [workspaces, boards]);
}

function useBoardOptions(workspaceId) {
  const boards        = useStore(s => s.boards);
  const boardsLoading = useStore(s => s.boardsLoading);
  return useMemo(() => {
    const filtered = !workspaceId
      ? boards
      : boards.filter(b => String(b.workspace?.id) === String(workspaceId));
    return {
      options: filtered.map(b => ({ value: b.id, label: b.name || `Board (${b.id})`, searchText: `${b.name || ''} ${b.id}`.toLowerCase() })),
      loading: boardsLoading,
      count:   filtered.length,
    };
  }, [boards, workspaceId, boardsLoading]);
}

// People options from workspace users
function useUserOptions() {
  const users = useStore(s => s.workspaceUsers);
  return useMemo(() =>
    users.map(u => ({ value: String(u.id), label: `${u.name} (${u.email})` })),
  [users]);
}

function useGroupOptions(boardId) {
  const boards = useStore(s => s.boards);
  return useMemo(() => {
    if (!boardId) return [];
    const board = boards.find(b => b.id === boardId);
    return (board?.groups || []).map(g => ({ value: g.id, label: g.title }));
  }, [boards, boardId]);
}

function useColumnOptions(boardId, types) {
  const boards = useStore(s => s.boards);
  return useMemo(() => {
    if (!boardId) return [];
    const board = boards.find(b => b.id === boardId);
    if (!board) return [];
    const cols = board.columns || [];
    const filtered = types ? cols.filter(c => types.includes(c.type)) : cols;
    return filtered.map(c => ({ value: c.id, label: `${c.title} (${c.type})`, type: c.type, settings_str: c.settings_str }));
  }, [boards, boardId, types]);
}

function useStatusValues(boardId, columnId) {
  const boards = useStore(s => s.boards);
  return useMemo(() => {
    if (!boardId || !columnId) return [];
    const board = boards.find(b => b.id === boardId);
    const col   = board?.columns?.find(c => c.id === columnId);
    if (!col) return [];
    try {
      const settings = JSON.parse(col.settings_str || '{}');
      // Return both label AND index for proper monday.com mapping
      return Object.entries(settings.labels || {})
        .filter(([, label]) => label)
        .map(([index, label]) => ({ value: index, label }));
    } catch { return []; }
  }, [boards, boardId, columnId]);
}

function useTokens(boardId) {
  const boards = useStore(s => s.boards);
  return useMemo(() => {
    const board = boards.find(b => b.id === boardId);
    return buildTokensFromBoard(board);
  }, [boards, boardId]);
}

function useTriggerGroupNumber(nodeId) {
  const nodes   = useStore(s => s.nodes);
  const triggers = nodes.filter(n => n.data?.nodeType === 'trigger');
  const index   = triggers.findIndex(n => n.id === nodeId);
  return { groupNumber: index + 1, totalTriggers: triggers.length };
}

// Check if a node has all required fields filled
function useNodeValidation(data) {
  const config = TEMPLATE_CONFIGS[data.templateId];
  if (!config) return true;
  const required = config.required || [];
  for (const req of required) {
    if (req === 'board'      && !data.selectedBoardId)  return false;
    if (req === 'column'     && !data.selectedColumnId) return false;
    if (req === 'group'      && !data.selectedGroupId)  return false;
    if (req === 'value'      && !data.value)            return false;
    if (req === 'recurrence' && !data.recurrence)       return false;
    if (req === 'item_name'  && !data.itemName)         return false;
    if (req === 'message'    && !data.message)          return false;
    if (req === 'email_to'   && !data.emailTo)          return false;
    if (req === 'email_subject' && !data.emailSubject)  return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// TEMPLATE FIELDS RENDERER
// ─────────────────────────────────────────────
function TemplateFields({ data, updateNodeData, color, t }) {
  const config        = TEMPLATE_CONFIGS[data.templateId] || { fields: [], notes: '' };
  const workspaceOpts = useWorkspaceOptions();
  const { options: boardOpts, loading: boardsLoading, count: boardCount } = useBoardOptions(data.selectedWorkspaceId);
  const userOpts       = useUserOptions();
  const groupOpts     = useGroupOptions(data.selectedBoardId);
  const tokens        = useTokens(data.selectedBoardId);

  const colField   = config.fields.find(f => f.startsWith('column:'));
  const colTypes   = colField ? colField.replace('column:', '').split('|') : null;
  const columnOpts = useColumnOptions(data.selectedBoardId, colTypes);
  const statusVals = useStatusValues(data.selectedBoardId, data.selectedColumnId);

  const boards = useStore(s => s.boards);
  const selectedColType = useMemo(() => {
    if (!data.selectedBoardId || !data.selectedColumnId) return null;
    const board = boards.find(b => b.id === data.selectedBoardId);
    return board?.columns?.find(c => c.id === data.selectedColumnId)?.type || null;
  }, [boards, data.selectedBoardId, data.selectedColumnId]);

  const handleWorkspaceChange = workspaceId => {
    // Store null for "all workspaces" instead of '__all__'
    updateNodeData(data.id, {
      selectedWorkspaceId: workspaceId === '__all__' ? null : workspaceId,
      selectedBoardId:     '',
      boardName:           '',
      selectedColumnId:    '',
      columnName:          '',
      selectedGroupId:     '',
      groupName:           '',
      value:               '',
    });
  };

  const fetchBoardDetails = useStore(s => s.fetchBoardDetails);

  const handleBoardChange = boardId => {
    const board = boardOpts.find(b => b.value === boardId);
    updateNodeData(data.id, {
      selectedBoardId:  boardId,
      boardName:        board?.label || '',
      selectedColumnId: '',
      columnName:       '',
      selectedGroupId:  '',
      groupName:        '',
      value:            '',
    });
    // Fetch columns + groups for selected board
    if (boardId) fetchBoardDetails(boardId);
  };

  const handleColumnChange = colId => {
    const col = columnOpts.find(c => c.value === colId);
    updateNodeData(data.id, { selectedColumnId: colId, columnName: col?.label || '', value: '' });
  };

  const handleGroupChange = groupId => {
    const group = groupOpts.find(g => g.value === groupId);
    updateNodeData(data.id, { selectedGroupId: groupId, groupName: group?.label || '' });
  };

  const fields   = config.fields;
  const required = config.required || [];

  return (
    <div>
      {/* WORKSPACE — always shown when board is needed */}
      {fields.includes('board') && (
        <>
          <FieldLabel text="Workspace" color={color} />
          <SearchableSelect
            value={data.selectedWorkspaceId || ''}
            onChange={handleWorkspaceChange}
            options={workspaceOpts}
            placeholder="Select workspace..."
            color={color}
          />
          {/* Board count indicator */}
          {data.selectedWorkspaceId && (
            <div style={{ color: color + '88', fontSize: 9, marginTop: 3, textAlign: 'right' }}>
              {boardsLoading ? 'Loading boards...' : `${boardCount} board${boardCount !== 1 ? 's' : ''} in this workspace`}
            </div>
          )}
        </>
      )}

      {/* BOARD */}
      {fields.includes('board') && (
        <>
          <FieldLabel text="Board" color={color} required={required.includes('board')} />
          <SearchableSelect value={data.selectedBoardId} onChange={handleBoardChange}
            options={boardOpts}
            placeholder={boardsLoading ? 'Loading boards...' : `Search ${boardOpts.length} boards...`}
            color={color} />
        </>
      )}

      {/* GROUP */}
      {fields.includes('group') && data.selectedBoardId && (
        <>
          <FieldLabel text="Group" color={color} required={required.includes('group')} />
          <SearchableSelect value={data.selectedGroupId} onChange={handleGroupChange}
            options={groupOpts} placeholder="Select group..." color={color} />
        </>
      )}

      {/* COLUMN */}
      {colField && data.selectedBoardId && (
        <>
          <FieldLabel text="Column" color={color} required={required.includes('column')} />
          <SearchableSelect value={data.selectedColumnId} onChange={handleColumnChange}
            options={columnOpts} placeholder="Select column..." color={color} />
        </>
      )}

      {/* VALUE — status (now uses index as value, label as display) */}
      {fields.includes('value:status') && data.selectedColumnId && (
        <>
          <FieldLabel text="Status Value" color={color} required={required.includes('value')} />
          {statusVals.length > 0
            ? <SearchableSelect value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
                options={statusVals} placeholder="Select status..." color={color} />
            : <NodeInput value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
                placeholder="Enter status value..." color={color} t={t} />
          }
        </>
      )}

      {/* VALUE — checkbox */}
      {fields.some(f => f.startsWith('value:')) && selectedColType === 'checkbox' && (
        <>
          <FieldLabel text="Checkbox State" color={color} required={required.includes('value')} />
          <SearchableSelect value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
            options={[
              { value: 'checked',   label: '✅ Checked'   },
              { value: 'unchecked', label: '⬜ Unchecked' },
            ]}
            placeholder="Select state..." color={color} />
        </>
      )}

      {/* VALUE — text */}
      {fields.includes('value:text') && data.selectedColumnId && selectedColType !== 'checkbox' && (
        <>
          <FieldLabel text="Value" color={color} required={required.includes('value')} />
          <NodeInput value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
            placeholder="Enter value..." color={color} t={t} />
        </>
      )}

      {/* VALUE — number */}
      {fields.includes('value:number') && data.selectedColumnId && (
        <>
          <FieldLabel text="Number Value" color={color} required={required.includes('value')} />
          <NodeInput value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
            placeholder="e.g. 100" color={color} t={t} type="number" />
        </>
      )}

      {/* DATE OFFSET */}
      {fields.includes('date_offset') && data.selectedColumnId && (
        <>
          <FieldLabel text="Date / Offset" color={color} />
          <NodeInput value={data.dateOffset} onChange={v => updateNodeData(data.id, { dateOffset: v })}
            placeholder="e.g. today, today+3, today-1..." color={color} t={t} />
        </>
      )}

      {/* RECURRENCE — fixed: now uses SearchableSelect */}
      {fields.includes('recurrence') && (
        <>
          <FieldLabel text="Repeat Every" color={color} required={required.includes('recurrence')} />
          <SearchableSelect
            value={data.recurrence}
            onChange={v => updateNodeData(data.id, { recurrence: v })}
            options={[
              { value: 'daily',   label: 'Every day'   },
              { value: 'weekly',  label: 'Every week'  },
              { value: 'monthly', label: 'Every month' },
            ]}
            placeholder="Select frequency..." color={color}
          />
        </>
      )}

      {/* RICH: ITEM NAME */}
      {fields.includes('rich:item_name') && (
        <RichTextField label="Item Name" value={data.itemName}
          onChange={v => updateNodeData(data.id, { itemName: v })}
          placeholder='e.g. Follow up — use {+} for dynamic values'
          color={color} tokens={tokens} t={t} />
      )}

      {/* RICH: MESSAGE */}
      {fields.includes('rich:message') && (
        <RichTextField label="Message" value={data.message}
          onChange={v => updateNodeData(data.id, { message: v })}
          placeholder='Type message — use {+} to insert dynamic values'
          color={color} tokens={tokens} t={t} />
      )}

      {/* RICH: EMAIL TO */}
      {fields.includes('rich:email_to') && (
        <RichTextField label="Send To (email)" value={data.emailTo}
          onChange={v => updateNodeData(data.id, { emailTo: v })}
          placeholder='recipient@email.com or use {+}'
          color={color} tokens={tokens} t={t} />
      )}

      {/* RICH: EMAIL SUBJECT */}
      {fields.includes('rich:email_subject') && (
        <RichTextField label="Subject" value={data.emailSubject}
          onChange={v => updateNodeData(data.id, { emailSubject: v })}
          placeholder='Email subject or use {+} for dynamic values'
          color={color} tokens={tokens} t={t} />
      )}

      {/* PERSON PICKER — for notify and assign */}
      {fields.includes('person_picker') && (
        <>
          <FieldLabel text="Person to Notify / Assign" color={color} required />
          <SearchableSelect
            value={data.selectedPersonId || ''}
            onChange={v => {
              const user = userOpts.find(u => u.value === v);
              updateNodeData(data.id, { selectedPersonId: v, personName: user?.label || '' });
            }}
            options={userOpts}
            placeholder="Search team members..."
            color={color}
          />
        </>
      )}

      {/* PLAIN EMAIL TO (not rich — email addresses only) */}
      {fields.includes('email_to') && (
        <>
          <FieldLabel text="Recipient Email" color={color} required={required.includes('email_to')} />
          <NodeInput
            value={data.emailTo || ''}
            onChange={v => updateNodeData(data.id, { emailTo: v })}
            placeholder="recipient@email.com"
            color={color} t={t} type="email"
          />
          <div style={{ color: color + '77', fontSize: 9, marginTop: 3 }}>
            💡 Sent via Mailjet — ensure MAILJET_API_KEY is set in backend
          </div>
        </>
      )}

      {/* NOTES */}
      <FieldLabel text="Notes (optional)" color={color} />
      <NodeInput value={data.notes || ''} onChange={v => updateNodeData(data.id, { notes: v })}
        placeholder={config.notes} color={color} t={t} />
    </div>
  );
}

// ─────────────────────────────────────────────
// TRIGGER NODE
// ─────────────────────────────────────────────
export const TriggerNode = memo(({ data, selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const theme          = useStore(s => s.theme);
  const t              = themes[theme];
  const { groupNumber, totalTriggers } = useTriggerGroupNumber(data.id);
  const isValid = useNodeValidation(data);

  return (
    <NodeShell data={data} selected={selected} targetHandle={false} isValid={isValid} t={t}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>{data.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <TypeBadge label="Trigger" color={data.color} />
              {totalTriggers > 1 && <GroupBadge groupNumber={groupNumber} color={data.color} />}
            </div>
            <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
              {data.label}
            </div>
          </div>
        </div>

        {totalTriggers > 1 && (
          <div style={{
            background: '#fdab3d18', border: '1px solid #fdab3d33',
            borderRadius: 6, padding: '5px 8px', fontSize: 10,
            color: '#fdab3d', marginBottom: 6, lineHeight: 1.4,
          }}>
            ⚠️ Multiple triggers = separate automations. Connect each to its own chain.
          </div>
        )}

        <TemplateFields data={data} updateNodeData={updateNodeData} color={data.color} t={t} />
      </div>
    </NodeShell>
  );
});

// ─────────────────────────────────────────────
// CONDITION NODE
// ─────────────────────────────────────────────
export const ConditionNode = memo(({ data, selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const theme          = useStore(s => s.theme);
  const t              = themes[theme];
  const isValid        = useNodeValidation(data);

  return (
    <NodeShell data={data} selected={selected} isValid={isValid} t={t}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{data.icon}</span>
          <div>
            <TypeBadge label="Condition" color={data.color} />
            <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
              {data.label}
            </div>
          </div>
        </div>
        <TemplateFields data={data} updateNodeData={updateNodeData} color={data.color} t={t} />
      </div>
    </NodeShell>
  );
});

// ─────────────────────────────────────────────
// ACTION NODE
// ─────────────────────────────────────────────
export const ActionNode = memo(({ data, selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const theme          = useStore(s => s.theme);
  const t              = themes[theme];
  const isValid        = useNodeValidation(data);

  return (
    <NodeShell data={data} selected={selected} isValid={isValid} t={t}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{data.icon}</span>
          <div>
            <TypeBadge label="Action" color={data.color} />
            <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
              {data.label}
            </div>
          </div>
        </div>
        <TemplateFields data={data} updateNodeData={updateNodeData} color={data.color} t={t} />
      </div>
    </NodeShell>
  );
});