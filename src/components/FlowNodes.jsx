// src/components/FlowNodes.jsx
// Template-specific nodes with dynamic token insertion for rich text fields

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
  status_changed:   { notes: 'Fires when a status column changes to a specific value.', fields: ['board', 'column:status', 'value:status'] },
  item_created:     { notes: 'Fires when any new item is created in the selected board.', fields: ['board'] },
  date_arrives:     { notes: 'Fires when a date column reaches today or a set offset (e.g. today+3).', fields: ['board', 'column:date|timeline', 'date_offset'] },
  column_changes:   { notes: 'Fires when any value in the selected column changes.', fields: ['board', 'column:text|numbers|dropdown|checkbox|rating'] },
  item_assigned:    { notes: 'Fires when a people column is changed — item assigned to someone.', fields: ['board', 'column:people|team'] },
  subitem_created:  { notes: 'Fires when a subitem is added to any item in the selected board.', fields: ['board'] },
  button_clicked:   { notes: 'Fires when a button column is clicked by a user.', fields: ['board', 'column:button'] },
  recurring_time:   { notes: 'Fires on a recurring schedule — daily, weekly, or monthly.', fields: ['board', 'recurrence'] },
  item_moved:       { notes: 'Fires when an item is moved into a specific group.', fields: ['board', 'group'] },
  dependency_met:   { notes: 'Fires when all dependent items linked to this item are marked done.', fields: ['board', 'column:dependency'] },
  // CONDITIONS
  status_is:        { notes: 'Only continues if the status column equals the selected value.', fields: ['board', 'column:status', 'value:status'] },
  person_is:        { notes: 'Only continues if the people column matches the specified person.', fields: ['board', 'column:people|team', 'value:text'] },
  group_is:         { notes: 'Only continues if the item currently belongs to the selected group.', fields: ['board', 'group'] },
  column_contains:  { notes: 'Only continues if the text column contains the specified word or phrase.', fields: ['board', 'column:text|long_text|email|phone|link', 'value:text'] },
  number_greater:   { notes: 'Only continues if the number column value is greater than the number specified.', fields: ['board', 'column:numbers|rating', 'value:number'] },
  date_is_past:     { notes: 'Only continues if the selected date column has already passed.', fields: ['board', 'column:date|timeline'] },
  checkbox_checked: { notes: 'Only continues if the selected checkbox column is ticked.', fields: ['board', 'column:checkbox'] },
  no_condition:     { notes: 'No condition — the action runs every time the trigger fires without filtering.', fields: [] },
  // ACTIONS
  notify_someone:   { notes: 'Sends a monday.com notification to a person or team with your message.', fields: ['board', 'column:people|team', 'rich:message'] },
  send_email:       { notes: 'Sends an automated email to the specified recipient.', fields: ['rich:email_to', 'rich:email_subject', 'rich:message'] },
  create_item:      { notes: 'Creates a new item in the target board and group with the specified name.', fields: ['board', 'group', 'rich:item_name'] },
  move_item:        { notes: 'Moves the triggering item into a different group.', fields: ['board', 'group'] },
  set_status:       { notes: 'Changes a status column to the selected value on the triggering item.', fields: ['board', 'column:status', 'value:status'] },
  assign_person:    { notes: 'Sets the people column to a specific person on the triggering item.', fields: ['board', 'column:people|team', 'value:text'] },
  set_date:         { notes: 'Sets a date column to today or a calculated offset (e.g. today+7).', fields: ['board', 'column:date|timeline', 'date_offset'] },
  create_subitem:   { notes: 'Adds a subitem to the triggering item with the specified name.', fields: ['board', 'rich:item_name'] },
  duplicate_item:   { notes: 'Creates an exact copy of the triggering item in the same or another board.', fields: ['board', 'group'] },
  archive_item:     { notes: 'Archives the triggering item — it will no longer appear in the active board.', fields: ['board'] },
  create_update:    { notes: 'Posts a message in the updates section of the triggering item.', fields: ['rich:message'] },
  connect_boards:   { notes: 'Links the triggering item to an item in another board via a board relation column.', fields: ['board', 'column:board_relation'] },
};

// ─────────────────────────────────────────────
// DYNAMIC TOKENS — built from selected board columns
// These are the variables a user can insert into rich text fields
// ─────────────────────────────────────────────
const STATIC_TOKENS = [
  { key: '{Item Name}',      label: 'Item Name',       category: 'Item'   },
  { key: '{Item ID}',        label: 'Item ID',         category: 'Item'   },
  { key: '{Board Name}',     label: 'Board Name',      category: 'Board'  },
  { key: '{Group Name}',     label: 'Group Name',      category: 'Board'  },
  { key: '{Today}',          label: 'Today\'s Date',   category: 'Date'   },
  { key: '{Triggered By}',   label: 'Triggered By',    category: 'User'   },
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
// RICH TEXT FIELD with token inserter
// ─────────────────────────────────────────────
function RichTextField({ value, onChange, placeholder, color, label, tokens }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = tokens.filter(t =>
    t.label.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group tokens by category
  const grouped = filtered.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const insertToken = (token) => {
    onChange((value || '') + token.key);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <FieldLabel text={label} color={color} />
      <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, background: '#060d1a',
            border: `1px solid ${color}44`, borderRadius: 6,
            color: '#c8d8e8', fontSize: 10, padding: '5px 8px',
            outline: 'none', fontFamily: '"DM Sans", sans-serif',
            boxSizing: 'border-box',
          }}
        />
        {/* Token insert button */}
        <button
          onClick={e => { e.stopPropagation(); setOpen(o => !o); setSearch(''); }}
          title="Insert dynamic value"
          style={{
            background:   open ? color + '33' : '#0d1f33',
            border:       `1px solid ${color}44`,
            borderRadius: 6,
            color:        color,
            fontSize:     11,
            fontWeight:   800,
            padding:      '0 8px',
            cursor:       'pointer',
            flexShrink:   0,
            fontFamily:   '"DM Sans", sans-serif',
          }}
        >{'{+}'}</button>
      </div>

      {/* Token preview pills inside the field */}
      {value && value.includes('{') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {(value.match(/\{[^}]+\}/g) || []).map((token, i) => (
            <span key={i} style={{
              background:   color + '22',
              border:       `1px solid ${color}44`,
              borderRadius: 99,
              color:        color,
              fontSize:     9,
              fontWeight:   700,
              padding:      '1px 6px',
            }}>{token}</span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:     'absolute',
            top:          '100%',
            left:         0,
            right:        0,
            zIndex:       9999,
            background:   '#0d1626',
            border:       `1px solid ${color}44`,
            borderRadius: 8,
            marginTop:    4,
            boxShadow:    '0 8px 32px #00000088',
            maxHeight:    220,
            overflowY:    'auto',
          }}
        >
          {/* Search */}
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search fields..."
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', background: '#060d1a',
                border: `1px solid ${color}33`, borderRadius: 5,
                color: '#c8d8e8', fontSize: 10, padding: '4px 8px',
                outline: 'none', fontFamily: '"DM Sans", sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Grouped tokens */}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{
                color: '#3a5070', fontSize: 9, fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '6px 10px 3px',
              }}>{category}</div>
              {items.map(token => (
                <div
                  key={token.key}
                  onClick={() => insertToken(token)}
                  style={{
                    padding: '6px 10px', cursor: 'pointer',
                    color: '#c8d8e8', fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = color + '22'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    background: color + '22', color, borderRadius: 4,
                    fontSize: 9, fontWeight: 700, padding: '1px 5px',
                    flexShrink: 0,
                  }}>{token.key}</span>
                  <span style={{ color: '#7eb8f7' }}>{token.label}</span>
                </div>
              ))}
            </div>
          ))}

          {Object.keys(grouped).length === 0 && (
            <div style={{ padding: '12px', color: '#3a5070', fontSize: 11, textAlign: 'center' }}>
              No fields match "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BASE UI COMPONENTS
// ─────────────────────────────────────────────
function NodeSelect({ value, onChange, options, placeholder, color }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', background: '#060d1a',
        border: `1px solid ${color}33`, borderRadius: 6,
        color: value ? '#c8d8e8' : '#3a5070',
        fontSize: 10, padding: '5px 8px', outline: 'none',
        fontFamily: '"DM Sans", sans-serif', marginTop: 5,
        boxSizing: 'border-box', cursor: 'pointer',
        appearance: 'none', WebkitAppearance: 'none',
      }}
    >
      <option value="" style={{ color: '#3a5070' }}>{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ color: '#c8d8e8', background: '#0d1626' }}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function NodeInput({ value, onChange, placeholder, color, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', background: '#060d1a',
        border: `1px solid ${color}33`, borderRadius: 6,
        color: '#8aabcc', fontSize: 10, padding: '5px 8px',
        outline: 'none', fontFamily: '"DM Sans", sans-serif',
        marginTop: 5, boxSizing: 'border-box',
      }}
    />
  );
}

function FieldLabel({ text, color }) {
  return (
    <div style={{
      color: color + 'aa', fontSize: 9, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      marginTop: 8, marginBottom: 1,
    }}>{text}</div>
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
      background: '#0a0a1a', color,
      border: `1px solid ${color}44`, borderRadius: 99,
      fontSize: 9, fontWeight: 800, padding: '2px 8px',
      letterSpacing: '0.06em', marginLeft: 4,
    }}>Automation #{groupNumber}</span>
  );
}

function NodeShell({ data, selected, children, sourceHandle = true, targetHandle = true }) {
  const deleteNode = useStore(s => s.deleteNode);
  return (
    <div style={{
      background: '#0d1626',
      border: `2px solid ${selected ? data.color : data.color + '55'}`,
      borderRadius: 14, minWidth: 270, maxWidth: 320,
      boxShadow: selected
        ? `0 0 20px ${data.color}44, 0 8px 32px #00000088`
        : '0 4px 16px #00000066',
      transition: 'all 0.15s ease',
      fontFamily: '"DM Sans", sans-serif', position: 'relative',
    }}>
      {targetHandle && (
        <Handle type="target" position={Position.Left}
          style={{ background: data.color, width: 10, height: 10, border: '2px solid #0d1626' }} />
      )}
      {sourceHandle && (
        <Handle type="source" position={Position.Right}
          style={{ background: data.color, width: 10, height: 10, border: '2px solid #0d1626' }} />
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
function useBoardOptions() {
  const boards = useStore(s => s.boards);
  return useMemo(() =>
    boards.map(b => ({ value: b.id, label: `${b.name} (${b.id})` })),
  [boards]);
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
    const col = board?.columns?.find(c => c.id === columnId);
    if (!col) return [];
    try {
      const settings = JSON.parse(col.settings_str || '{}');
      return Object.values(settings.labels || {}).filter(Boolean).map(l => ({ value: l, label: l }));
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
  const nodes = useStore(s => s.nodes);
  const triggers = nodes.filter(n => n.data?.nodeType === 'trigger');
  const index = triggers.findIndex(n => n.id === nodeId);
  return { groupNumber: index + 1, totalTriggers: triggers.length };
}

// ─────────────────────────────────────────────
// TEMPLATE FIELDS RENDERER
// ─────────────────────────────────────────────
function TemplateFields({ data, updateNodeData, color }) {
  const config      = TEMPLATE_CONFIGS[data.templateId] || { fields: [], notes: '' };
  const boardOpts   = useBoardOptions();
  const groupOpts   = useGroupOptions(data.selectedBoardId);
  const tokens      = useTokens(data.selectedBoardId);

  const colField    = config.fields.find(f => f.startsWith('column:'));
  const colTypes    = colField ? colField.replace('column:', '').split('|') : null;
  const columnOpts  = useColumnOptions(data.selectedBoardId, colTypes);
  const statusVals  = useStatusValues(data.selectedBoardId, data.selectedColumnId);

  const boards = useStore(s => s.boards);
  const selectedColType = useMemo(() => {
    if (!data.selectedBoardId || !data.selectedColumnId) return null;
    const board = boards.find(b => b.id === data.selectedBoardId);
    return board?.columns?.find(c => c.id === data.selectedColumnId)?.type || null;
  }, [boards, data.selectedBoardId, data.selectedColumnId]);

  const handleBoardChange = boardId => {
    const board = boardOpts.find(b => b.value === boardId);
    updateNodeData(data.id, {
      selectedBoardId: boardId, boardName: board?.label || '',
      selectedColumnId: '', columnName: '', selectedGroupId: '',
      groupName: '', value: '',
    });
  };

  const handleColumnChange = colId => {
    const col = columnOpts.find(c => c.value === colId);
    updateNodeData(data.id, { selectedColumnId: colId, columnName: col?.label || '', value: '' });
  };

  const handleGroupChange = groupId => {
    const group = groupOpts.find(g => g.value === groupId);
    updateNodeData(data.id, { selectedGroupId: groupId, groupName: group?.label || '' });
  };

  const fields = config.fields;

  return (
    <div>
      {/* BOARD */}
      {fields.includes('board') && (
        <>
          <FieldLabel text="Board" color={color} />
          <SearchableSelect value={data.selectedBoardId} onChange={handleBoardChange} options={boardOpts} placeholder="Search and select board..." color={color} />
        </>
      )}

      {/* GROUP */}
      {fields.includes('group') && data.selectedBoardId && (
        <>
          <FieldLabel text="Group" color={color} />
          <SearchableSelect value={data.selectedGroupId} onChange={handleGroupChange} options={groupOpts} placeholder="Select group..." color={color} />
        </>
      )}

      {/* COLUMN */}
      {colField && data.selectedBoardId && (
        <>
          <FieldLabel text="Column" color={color} />
          <SearchableSelect value={data.selectedColumnId} onChange={handleColumnChange} options={columnOpts} placeholder="Select column..." color={color} />
        </>
      )}

      {/* VALUE — status */}
      {fields.includes('value:status') && data.selectedColumnId && (
        <>
          <FieldLabel text="Status Value" color={color} />
          {statusVals.length > 0
            ? <NodeSelect value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
                options={statusVals} placeholder="Select status..." color={color} />
            : <NodeInput value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
                placeholder="Enter status value..." color={color} />
          }
        </>
      )}

      {/* VALUE — checkbox auto-detected */}
      {fields.some(f => f.startsWith('value:')) && selectedColType === 'checkbox' && (
        <>
          <FieldLabel text="Checkbox State" color={color} />
          <NodeSelect value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
            options={[{ value: 'checked', label: '✅ Checked' }, { value: 'unchecked', label: '⬜ Unchecked' }]}
            placeholder="Select state..." color={color} />
        </>
      )}

      {/* VALUE — text */}
      {fields.includes('value:text') && data.selectedColumnId && selectedColType !== 'checkbox' && (
        <>
          <FieldLabel text="Value" color={color} />
          <NodeInput value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
            placeholder="Enter value..." color={color} />
        </>
      )}

      {/* VALUE — number */}
      {fields.includes('value:number') && data.selectedColumnId && (
        <>
          <FieldLabel text="Number Value" color={color} />
          <NodeInput value={data.value} onChange={v => updateNodeData(data.id, { value: v })}
            placeholder="e.g. 100" color={color} type="number" />
        </>
      )}

      {/* DATE OFFSET */}
      {fields.includes('date_offset') && data.selectedColumnId && (
        <>
          <FieldLabel text="Date / Offset" color={color} />
          <NodeInput value={data.dateOffset} onChange={v => updateNodeData(data.id, { dateOffset: v })}
            placeholder="e.g. today, today+3, today-1..." color={color} />
        </>
      )}

      {/* RECURRENCE */}
      {fields.includes('recurrence') && (
        <>
          <FieldLabel text="Repeat Every" color={color} />
          <NodeSelect value={data.recurrence} onChange={v => updateNodeData(data.id, { recurrence: v })}
            options={[
              { value: 'daily',   label: 'Every day'   },
              { value: 'weekly',  label: 'Every week'  },
              { value: 'monthly', label: 'Every month' },
            ]}
            placeholder="Select frequency..." color={color} />
        </>
      )}

      {/* RICH: ITEM NAME */}
      {fields.includes('rich:item_name') && (
        <RichTextField
          label="Item Name"
          value={data.itemName}
          onChange={v => updateNodeData(data.id, { itemName: v })}
          placeholder='e.g. Follow up or type {+} for dynamic values'
          color={color}
          tokens={tokens}
        />
      )}

      {/* RICH: MESSAGE */}
      {fields.includes('rich:message') && (
        <RichTextField
          label="Message"
          value={data.message}
          onChange={v => updateNodeData(data.id, { message: v })}
          placeholder='Type your message or use {+} to insert dynamic values'
          color={color}
          tokens={tokens}
        />
      )}

      {/* RICH: EMAIL TO */}
      {fields.includes('rich:email_to') && (
        <RichTextField
          label="Send To (email)"
          value={data.emailTo}
          onChange={v => updateNodeData(data.id, { emailTo: v })}
          placeholder='recipient@email.com or use {+} for dynamic email'
          color={color}
          tokens={tokens}
        />
      )}

      {/* RICH: EMAIL SUBJECT */}
      {fields.includes('rich:email_subject') && (
        <RichTextField
          label="Subject"
          value={data.emailSubject}
          onChange={v => updateNodeData(data.id, { emailSubject: v })}
          placeholder='Email subject or use {+} for dynamic values'
          color={color}
          tokens={tokens}
        />
      )}

      {/* NOTES — always last with smart placeholder */}
      <FieldLabel text="Notes (optional)" color={color} />
      <NodeInput
        value={data.notes || ''}
        onChange={v => updateNodeData(data.id, { notes: v })}
        placeholder={config.notes}
        color={color}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// TRIGGER NODE
// ─────────────────────────────────────────────
export const TriggerNode = memo(({ data, selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const { groupNumber, totalTriggers } = useTriggerGroupNumber(data.id);

  return (
    <NodeShell data={data} selected={selected} targetHandle={false}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>{data.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <TypeBadge label="Trigger" color={data.color} />
              {totalTriggers > 1 && <GroupBadge groupNumber={groupNumber} color={data.color} />}
            </div>
            <div style={{ color: '#e8f0fe', fontWeight: 700, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
              {data.label}
            </div>
          </div>
        </div>

        {totalTriggers > 1 && (
          <div style={{
            background: '#1a0f00', border: '1px solid #fdab3d33',
            borderRadius: 6, padding: '5px 8px', fontSize: 10,
            color: '#fdab3d', marginBottom: 6, lineHeight: 1.4,
          }}>
            ⚠️ Multiple triggers = separate automations. Connect each to its own chain.
          </div>
        )}

        <TemplateFields data={data} updateNodeData={updateNodeData} color={data.color} />
      </div>
    </NodeShell>
  );
});

// ─────────────────────────────────────────────
// CONDITION NODE
// ─────────────────────────────────────────────
export const ConditionNode = memo(({ data, selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  return (
    <NodeShell data={data} selected={selected}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{data.icon}</span>
          <div>
            <TypeBadge label="Condition" color={data.color} />
            <div style={{ color: '#e8f0fe', fontWeight: 700, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
              {data.label}
            </div>
          </div>
        </div>
        <TemplateFields data={data} updateNodeData={updateNodeData} color={data.color} />
      </div>
    </NodeShell>
  );
});

// ─────────────────────────────────────────────
// ACTION NODE
// ─────────────────────────────────────────────
export const ActionNode = memo(({ data, selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  return (
    <NodeShell data={data} selected={selected}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{data.icon}</span>
          <div>
            <TypeBadge label="Action" color={data.color} />
            <div style={{ color: '#e8f0fe', fontWeight: 700, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
              {data.label}
            </div>
          </div>
        </div>
        <TemplateFields data={data} updateNodeData={updateNodeData} color={data.color} />
      </div>
    </NodeShell>
  );
});