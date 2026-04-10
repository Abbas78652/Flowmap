// src/utils/flowBuilder.js
// Node templates and flow utilities for the drag-and-drop builder

import dagre from 'dagre';

const NODE_WIDTH  = 260;
const NODE_HEIGHT = 100;

// ─────────────────────────────────────────────
// MONDAY.COM TRIGGER TEMPLATES
// ─────────────────────────────────────────────
export const TRIGGER_TEMPLATES = [
  { id: 'status_changed',  label: 'Status changes',            icon: '🔄', color: '#6c63ff', description: 'When a status column changes to a specific value' },
  { id: 'item_created',    label: 'Item created',              icon: '✨', color: '#00ca72', description: 'When a new item is created in the board' },
  { id: 'date_arrives',    label: 'Date arrives',              icon: '📅', color: '#00c2e0', description: 'When a date column reaches a specific date' },
  { id: 'column_changes',  label: 'Column value changes',      icon: '✏️', color: '#fdab3d', description: 'When any column value is changed' },
  { id: 'item_assigned',   label: 'Item assigned to someone',  icon: '👤', color: '#ff642e', description: 'When a person column is changed' },
  { id: 'subitem_created', label: 'Subitem created',           icon: '📎', color: '#a25ddc', description: 'When a subitem is added to an item' },
  { id: 'button_clicked',  label: 'Button clicked',            icon: '🖱️', color: '#e2445c', description: 'When a button column is clicked' },
  { id: 'recurring_time',  label: 'Every time period',         icon: '⏰', color: '#579bfc', description: 'On a recurring schedule' },
  { id: 'item_moved',      label: 'Item moved to group',       icon: '📦', color: '#bb3354', description: 'When an item is moved to a different group' },
  { id: 'dependency_met',  label: 'Dependency item done',      icon: '🔗', color: '#037f4c', description: 'When a dependent item is marked done' },
];

// ─────────────────────────────────────────────
// MONDAY.COM CONDITION TEMPLATES
// ─────────────────────────────────────────────
export const CONDITION_TEMPLATES = [
  { id: 'status_is',       label: 'Status is',                 icon: '🎯', color: '#fdab3d', description: 'Only if a status column equals a specific value' },
  { id: 'person_is',       label: 'Assigned to person',        icon: '👤', color: '#fdab3d', description: 'Only if item is assigned to a specific person' },
  { id: 'group_is',        label: 'Item is in group',          icon: '📁', color: '#fdab3d', description: 'Only if item belongs to a specific group' },
  { id: 'column_contains', label: 'Column contains text',      icon: '🔍', color: '#fdab3d', description: 'Only if a text column contains specific words' },
  { id: 'number_greater',  label: 'Number is greater than',    icon: '📊', color: '#fdab3d', description: 'Only if a number column exceeds a value' },
  { id: 'date_is_past',    label: 'Date has passed',           icon: '⌛', color: '#fdab3d', description: 'Only if a date column is in the past' },
  { id: 'checkbox_checked',label: 'Checkbox is checked',       icon: '☑️', color: '#fdab3d', description: 'Only if a checkbox column is ticked' },
  { id: 'no_condition',    label: 'No condition (always run)', icon: '✅', color: '#fdab3d', description: 'Run the action every time without conditions' },
];

// ─────────────────────────────────────────────
// MONDAY.COM ACTION TEMPLATES
// ─────────────────────────────────────────────
export const ACTION_TEMPLATES = [
  { id: 'notify_someone',  label: 'Notify someone',            icon: '🔔', color: '#00ca72', description: 'Send a notification to a person or team' },
  { id: 'send_email',      label: 'Send an email',             icon: '📧', color: '#00ca72', description: 'Send an automated email' },
  { id: 'create_item',     label: 'Create an item',            icon: '➕', color: '#00ca72', description: 'Create a new item in this or another board' },
  { id: 'move_item',       label: 'Move item to group',        icon: '📦', color: '#00ca72', description: 'Move the item to a different group' },
  { id: 'set_status',      label: 'Set status',                icon: '🏷️', color: '#00ca72', description: 'Change a status column to a specific value' },
  { id: 'assign_person',   label: 'Assign person',             icon: '👤', color: '#00ca72', description: 'Set a people column to a specific person' },
  { id: 'set_date',        label: 'Set date',                  icon: '📅', color: '#00ca72', description: 'Set a date column to a specific date' },
  { id: 'create_subitem',  label: 'Create subitem',            icon: '📎', color: '#00ca72', description: 'Add a subitem to the current item' },
  { id: 'duplicate_item',  label: 'Duplicate item',            icon: '📋', color: '#00ca72', description: 'Create a copy of the item' },
  { id: 'archive_item',    label: 'Archive item',              icon: '🗃️', color: '#00ca72', description: 'Archive the item from the board' },
  { id: 'create_update',   label: 'Post an update',            icon: '💬', color: '#00ca72', description: 'Post a message in the item updates section' },
  { id: 'connect_boards',  label: 'Connect to another board',  icon: '🔗', color: '#e2445c', description: 'Link this item to an item in another board' },
];

// ─────────────────────────────────────────────
// CREATE A NEW NODE OBJECT
// ─────────────────────────────────────────────
export function createNode(type, template, position) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  return {
    id,
    type: `${type}Node`,
    position: position || { x: 200, y: 200 },
    data: {
      id,
      nodeType:    type,
      templateId:  template.id,
      label:       template.label,
      icon:        template.icon,
      color:       template.color,
      description: template.description,
      notes:       '',
      boardName:   '',
      columnName:  '',
      value:       '',
    },
  };
}

// ─────────────────────────────────────────────
// AUTO-LAYOUT WITH DAGRE
// ─────────────────────────────────────────────
export function applyAutoLayout(nodes, edges) {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 60 });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach(e => { if (e.source && e.target) g.setEdge(e.source, e.target); });
  dagre.layout(g);
  return nodes.map(n => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

// ─────────────────────────────────────────────
// QUICK LOCAL AUDIT (no AI needed)
// ─────────────────────────────────────────────
export function quickAudit(nodes, edges) {
  const warnings = [];
  const triggers   = nodes.filter(n => n.data?.nodeType === 'trigger');
  const conditions = nodes.filter(n => n.data?.nodeType === 'condition');
  const actions    = nodes.filter(n => n.data?.nodeType === 'action');

  if (triggers.length === 0)
    warnings.push({ type: 'error', message: 'No trigger defined — automation will never start' });
  if (actions.length === 0)
    warnings.push({ type: 'error', message: 'No action defined — automation does nothing' });
  if (triggers.length > 3)
    warnings.push({ type: 'warning', message: `${triggers.length} triggers — verify they don't conflict with each other` });
  if (conditions.length === 0 && actions.length > 0)
    warnings.push({ type: 'info', message: 'No conditions set — actions run on every trigger event without filtering' });

  const connectedIds = new Set([...edges.map(e => e.source), ...edges.map(e => e.target)]);
  const orphans = nodes.filter(n => !connectedIds.has(n.id));
  if (orphans.length > 0)
    warnings.push({ type: 'warning', message: `${orphans.length} node(s) are not connected to any other node` });

  return warnings;
}

// ─────────────────────────────────────────────
// SERIALIZE FLOW FOR AI AUDIT
// ─────────────────────────────────────────────
export function serializeFlowForAI(nodes, edges, flowName) {
  const triggers   = nodes.filter(n => n.data?.nodeType === 'trigger');
  const conditions = nodes.filter(n => n.data?.nodeType === 'condition');
  const actions    = nodes.filter(n => n.data?.nodeType === 'action');

  const fmt = n =>
    `  - ${n.data.icon} ${n.data.label}` +
    (n.data.boardName  ? ` [Board: ${n.data.boardName}]`   : '') +
    (n.data.columnName ? ` [Column: ${n.data.columnName}]` : '') +
    (n.data.value      ? ` [Value: ${n.data.value}]`       : '') +
    (n.data.notes      ? ` | Notes: ${n.data.notes}`       : '');

  return [
    `Flow: "${flowName || 'Untitled'}"`,
    `Nodes: ${nodes.length} | Connections: ${edges.length}`,
    '',
    'TRIGGERS:', ...triggers.map(fmt),
    '',
    'CONDITIONS:', ...(conditions.length ? conditions.map(fmt) : ['  - None']),
    '',
    'ACTIONS:', ...actions.map(fmt),
    '',
    'CONNECTION MAP:',
    ...edges.map(e => {
      const s = nodes.find(n => n.id === e.source)?.data?.label || '?';
      const t = nodes.find(n => n.id === e.target)?.data?.label || '?';
      return `  - ${s} → ${t}`;
    }),
  ].join('\n');
}
