// server/index.js
// FlowMap Backend — OAuth + monday API proxy + Webhook Engine + Action Executor

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// IN-MEMORY FLOW STORE
// In production this moves to a real DB (monday Document DB or Supabase)
// Key: flowId, Value: { flow, token, webhookIds[] }
// ─────────────────────────────────────────────
const activeFlows = new Map();   // flowId → { flow, token, webhookIds }
const execLogs    = new Map();   // flowId → [{ timestamp, status, message }]

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:      'ok',
    app:         'FlowMap',
    version:     '1.0.0',
    activeFlows: activeFlows.size,
  });
});

// ─────────────────────────────────────────────
// OAUTH — Step 1: Redirect to monday.com
// ─────────────────────────────────────────────
app.get('/auth/monday', (req, res) => {
  const clientId    = process.env.REACT_APP_MONDAY_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
  res.redirect(`https://auth.monday.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`);
});

// ─────────────────────────────────────────────
// OAUTH — Step 2: Exchange code for token
// ─────────────────────────────────────────────
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const response = await axios.post(
      'https://auth.monday.com/oauth2/token',
      {
        client_id:     process.env.REACT_APP_MONDAY_CLIENT_ID,
        client_secret: process.env.MONDAY_CLIENT_SECRET,
        code,
        redirect_uri:  process.env.REDIRECT_URI,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const { access_token } = response.data;
    const frontendPort = process.env.FRONTEND_PORT || 3002;
    res.redirect(`http://localhost:${frontendPort}?token=${access_token}`);
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

// ─────────────────────────────────────────────
// MONDAY API PROXY
// ─────────────────────────────────────────────
app.post('/api/monday', async (req, res) => {
  const token            = req.headers['authorization']?.split(' ')[1];
  const { query, variables } = req.body;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const response = await mondayAPI(query, variables, token);
    res.json(response);
  } catch (err) {
    console.error('monday API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'monday API failed', details: err.response?.data });
  }
});

// ─────────────────────────────────────────────
// AI AUDIT
// ─────────────────────────────────────────────
app.post('/api/audit', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key':         process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type':      'application/json',
        },
      }
    );
    res.json({ result: response.data?.content?.[0]?.text || 'No response' });
  } catch (err) {
    console.error('Anthropic error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI audit failed' });
  }
});

// ─────────────────────────────────────────────
// ACTIVATE FLOW
// Registers monday.com webhooks for every trigger node
// ─────────────────────────────────────────────
app.post('/api/flows/activate', async (req, res) => {
  const token        = req.headers['authorization']?.split(' ')[1];
  const { flow }     = req.body;

  if (!token) return res.status(401).json({ error: 'No token' });
  if (!flow)  return res.status(400).json({ error: 'No flow provided' });

  const triggerNodes = flow.nodes.filter(n => n.data?.nodeType === 'trigger');
  if (triggerNodes.length === 0) {
    return res.status(400).json({ error: 'Flow has no trigger nodes' });
  }

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL || `http://localhost:${PORT}`}/webhook/monday/${flow.id}`;
  const registeredWebhooks = [];
  const errors = [];

  for (const trigger of triggerNodes) {
    const boardId     = trigger.data?.selectedBoardId;
    const triggerType = mapTriggerToWebhookEvent(trigger.data?.templateId);

    if (!boardId) {
      errors.push(`Trigger "${trigger.data?.label}" has no board selected`);
      continue;
    }
    if (!triggerType) {
      errors.push(`Trigger "${trigger.data?.label}" type not supported for webhooks yet`);
      continue;
    }

    try {
      const mutation = `
        mutation CreateWebhook($boardId: ID!, $url: String!, $event: WebhookEventType!) {
          create_webhook(board_id: $boardId, url: $url, event: $event) {
            id
            board_id
          }
        }
      `;
      const result = await mondayAPI(mutation, {
        boardId: parseInt(boardId),
        url:     webhookUrl,
        event:   triggerType,
      }, token);

      const webhookId = result?.data?.create_webhook?.id;
      if (webhookId) {
        registeredWebhooks.push({ webhookId, boardId, triggerType, nodeId: trigger.id });
        console.log(`✅ Webhook registered: ${webhookId} for board ${boardId} (${triggerType})`);
      }
    } catch (err) {
      console.error(`Webhook registration failed for board ${boardId}:`, err.message);
      errors.push(`Failed to register webhook for board ${boardId}: ${err.message}`);
    }
  }

  if (registeredWebhooks.length === 0) {
    return res.status(500).json({ error: 'No webhooks could be registered', errors });
  }

  // Store the active flow
  activeFlows.set(flow.id, { flow, token, webhookIds: registeredWebhooks });
  execLogs.set(flow.id, [{
    timestamp: new Date().toISOString(),
    status:    'activated',
    message:   `Flow activated with ${registeredWebhooks.length} webhook(s)`,
  }]);

  console.log(`🟢 Flow activated: ${flow.name} (${flow.id}) — ${registeredWebhooks.length} webhooks`);

  res.json({
    success:  true,
    flowId:   flow.id,
    webhooks: registeredWebhooks,
    errors:   errors.length > 0 ? errors : undefined,
  });
});

// ─────────────────────────────────────────────
// DEACTIVATE FLOW
// Removes all registered webhooks for the flow
// ─────────────────────────────────────────────
app.post('/api/flows/deactivate', async (req, res) => {
  const token    = req.headers['authorization']?.split(' ')[1];
  const { flowId } = req.body;

  if (!token)  return res.status(401).json({ error: 'No token' });
  if (!flowId) return res.status(400).json({ error: 'No flowId' });

  const stored = activeFlows.get(flowId);
  if (!stored) return res.json({ success: true, message: 'Flow was not active' });

  const errors = [];
  for (const wh of stored.webhookIds || []) {
    try {
      const mutation = `
        mutation DeleteWebhook($webhookId: ID!) {
          delete_webhook(id: $webhookId) { id }
        }
      `;
      await mondayAPI(mutation, { webhookId: wh.webhookId }, token);
      console.log(`🗑 Webhook deleted: ${wh.webhookId}`);
    } catch (err) {
      console.error(`Failed to delete webhook ${wh.webhookId}:`, err.message);
      errors.push(err.message);
    }
  }

  activeFlows.delete(flowId);
  addLog(flowId, 'deactivated', 'Flow deactivated — all webhooks removed');

  res.json({ success: true, errors: errors.length > 0 ? errors : undefined });
});

// ─────────────────────────────────────────────
// GET EXECUTION LOGS
// ─────────────────────────────────────────────
app.get('/api/flows/:flowId/logs', (req, res) => {
  const logs = execLogs.get(req.params.flowId) || [];
  res.json({ logs: logs.slice(-50) }); // last 50 entries
});

// ─────────────────────────────────────────────
// WEBHOOK RECEIVER
// monday.com sends events here when triggers fire
// ─────────────────────────────────────────────
app.post('/webhook/monday/:flowId', async (req, res) => {
  // Monday challenge verification
  const { challenge } = req.body;
  if (challenge) return res.json({ challenge });

  const { flowId } = req.params;
  const event      = req.body?.event;

  if (!event) return res.status(400).json({ error: 'No event' });

  console.log(`\n⚡ Webhook received for flow ${flowId}:`, event.type);

  const stored = activeFlows.get(flowId);
  if (!stored) {
    console.log(`Flow ${flowId} not found in active flows`);
    return res.status(404).json({ error: 'Flow not active' });
  }

  // Acknowledge immediately (monday requires fast response)
  res.json({ status: 'received' });

  // Execute flow asynchronously
  executeFlow(stored.flow, stored.token, event).catch(err => {
    console.error(`Flow execution error for ${flowId}:`, err.message);
    addLog(flowId, 'error', `Execution failed: ${err.message}`);
  });
});

// ─────────────────────────────────────────────
// FLOW EXECUTION ENGINE
// Evaluates conditions and runs actions
// ─────────────────────────────────────────────
async function executeFlow(flow, token, event) {
  const flowId = flow.id;
  console.log(`\n🔄 Executing flow: ${flow.name}`);
  addLog(flowId, 'triggered', `Triggered by event: ${event.type} on board ${event.boardId}`);

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

  // Find which trigger node fired
  const triggerNode = findFiredTrigger(nodes, event);
  if (!triggerNode) {
    addLog(flowId, 'skipped', 'No matching trigger node for this event');
    return;
  }

  console.log(`  ✅ Trigger matched: ${triggerNode.data.label}`);

  // Walk the graph from trigger → conditions → actions
  const chain = buildExecutionChain(triggerNode, nodes, edges);
  console.log(`  📋 Execution chain: ${chain.map(n => n.data.label).join(' → ')}`);

  // Evaluate conditions
  for (const node of chain) {
    if (node.data.nodeType === 'condition') {
      const passed = await evaluateCondition(node, event, token);
      if (!passed) {
        const msg = `Condition "${node.data.label}" not met — flow stopped`;
        console.log(`  🚫 ${msg}`);
        addLog(flowId, 'condition_failed', msg);
        return;
      }
      console.log(`  ✅ Condition passed: ${node.data.label}`);
      addLog(flowId, 'condition_passed', `Condition "${node.data.label}" passed`);
    }
  }

  // Execute actions
  for (const node of chain) {
    if (node.data.nodeType === 'action') {
      try {
        const result = await executeAction(node, event, token);
        const msg = `Action "${node.data.label}" executed successfully${result ? `: ${result}` : ''}`;
        console.log(`  ⚙️  ${msg}`);
        addLog(flowId, 'action_success', msg);
      } catch (err) {
        const msg = `Action "${node.data.label}" failed: ${err.message}`;
        console.error(`  ❌ ${msg}`);
        addLog(flowId, 'action_error', msg);
      }
    }
  }

  addLog(flowId, 'completed', 'Flow execution completed');
  console.log(`  ✅ Flow execution complete: ${flow.name}`);
}

// ─────────────────────────────────────────────
// FIND WHICH TRIGGER NODE MATCHES THE EVENT
// ─────────────────────────────────────────────
function findFiredTrigger(nodes, event) {
  const triggerNodes = nodes.filter(n => n.data?.nodeType === 'trigger');

  for (const t of triggerNodes) {
    const expectedEvent = mapTriggerToWebhookEvent(t.data?.templateId);
    const boardMatches  = !t.data?.selectedBoardId || t.data.selectedBoardId == event.boardId;

    if (!boardMatches) continue;

    // For status triggers, check if the column and value match
    if (t.data?.templateId === 'status_changed') {
      const colMatches = !t.data?.selectedColumnId || t.data.selectedColumnId == event.columnId;
      const valMatches = !t.data?.value || event.value?.label?.text === t.data.value;
      if (colMatches && valMatches) return t;
      continue;
    }

    if (expectedEvent && event.type === expectedEvent) return t;
    if (event.type === 'change_column_value' && t.data?.templateId === 'column_changes') return t;
    if (event.type === 'create_item'         && t.data?.templateId === 'item_created')  return t;
    if (event.type === 'change_status'       && t.data?.templateId === 'status_changed') return t;
  }

  return null;
}

// ─────────────────────────────────────────────
// BUILD EXECUTION CHAIN
// Traverses the graph from trigger to end
// ─────────────────────────────────────────────
function buildExecutionChain(startNode, nodes, edges) {
  const chain   = [];
  const visited = new Set();
  let   current = startNode;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.data.nodeType !== 'trigger') chain.push(current);

    // Find the next connected node
    const outgoingEdge = edges.find(e => e.source === current.id);
    if (!outgoingEdge) break;
    current = nodes.find(n => n.id === outgoingEdge.target);
  }

  return chain;
}

// ─────────────────────────────────────────────
// CONDITION EVALUATOR
// ─────────────────────────────────────────────
async function evaluateCondition(node, event, token) {
  const { templateId, selectedBoardId, selectedColumnId, value, selectedGroupId } = node.data;

  switch (templateId) {
    case 'no_condition':
      return true;

    case 'status_is': {
      if (!selectedColumnId || !value) return true;
      const itemData = await getItemColumnValue(event.pulseId, selectedColumnId, token);
      return itemData?.text === value;
    }

    case 'group_is': {
      if (!selectedGroupId) return true;
      const item = await getItem(event.pulseId, token);
      return item?.group?.id === selectedGroupId;
    }

    case 'checkbox_checked': {
      if (!selectedColumnId) return true;
      const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
      const checked = value === 'checked';
      return colVal?.value === (checked ? 'true' : null);
    }

    case 'number_greater': {
      if (!selectedColumnId || !value) return true;
      const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
      return parseFloat(colVal?.text || 0) > parseFloat(value);
    }

    case 'person_is': {
      if (!selectedColumnId || !value) return true;
      const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
      return (colVal?.text || '').toLowerCase().includes(value.toLowerCase());
    }

    case 'column_contains': {
      if (!selectedColumnId || !value) return true;
      const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
      return (colVal?.text || '').toLowerCase().includes(value.toLowerCase());
    }

    case 'date_is_past': {
      if (!selectedColumnId) return true;
      const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
      if (!colVal?.text) return false;
      return new Date(colVal.text) < new Date();
    }

    default:
      return true;
  }
}

// ─────────────────────────────────────────────
// ACTION EXECUTOR
// Runs the actual monday.com API calls
// ─────────────────────────────────────────────
async function executeAction(node, event, token) {
  const {
    templateId, selectedBoardId, selectedGroupId, selectedColumnId,
    value, itemName, message, emailTo, emailSubject,
  } = node.data;

  // Resolve dynamic tokens in text fields
  const resolveTokens = (text) => {
    if (!text) return text;
    return text
      .replace(/\{Item Name\}/g,    event.pulseName  || '')
      .replace(/\{Item ID\}/g,      event.pulseId    || '')
      .replace(/\{Board Name\}/g,   event.boardName  || '')
      .replace(/\{Group Name\}/g,   event.groupName  || '')
      .replace(/\{Today\}/g,        new Date().toISOString().split('T')[0])
      .replace(/\{Triggered By\}/g, event.userName   || '');
  };

  const targetBoard = selectedBoardId ? parseInt(selectedBoardId) : parseInt(event.boardId);

  switch (templateId) {

    // ── CREATE ITEM ──
    case 'create_item': {
      const name    = resolveTokens(itemName) || `New Item from ${event.pulseName}`;
      const groupId = selectedGroupId || null;
      const mutation = groupId
        ? `mutation($boardId: ID!, $groupId: String!, $itemName: String!) {
            create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName) { id name }
          }`
        : `mutation($boardId: ID!, $itemName: String!) {
            create_item(board_id: $boardId, item_name: $itemName) { id name }
          }`;
      const vars = groupId
        ? { boardId: targetBoard, groupId, itemName: name }
        : { boardId: targetBoard, itemName: name };
      const result = await mondayAPI(mutation, vars, token);
      const newItem = result?.data?.create_item;
      return `Created item "${newItem?.name}" (ID: ${newItem?.id})`;
    }

    // ── NOTIFY SOMEONE ──
    case 'notify_someone': {
      const text = resolveTokens(message) || `FlowMap notification for: ${event.pulseName}`;
      // Get user ID from the people column
      const colVal = selectedColumnId
        ? await getItemColumnValue(event.pulseId, selectedColumnId, token)
        : null;
      const userId = colVal?.persons_and_teams?.[0]?.id || event.userId;
      if (!userId) return 'No recipient found — notification skipped';
      const mutation = `
        mutation($userId: ID!, $text: String!, $itemId: ID!) {
          create_notification(user_id: $userId, target_id: $itemId, text: $text, target_type: Project) {
            text
          }
        }
      `;
      await mondayAPI(mutation, { userId: parseInt(userId), text, itemId: parseInt(event.pulseId) }, token);
      return `Notification sent to user ${userId}`;
    }

    // ── SET STATUS ──
    case 'set_status': {
      if (!selectedColumnId || !value) return 'No column or value — skipped';
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_simple_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
            id
          }
        }
      `;
      await mondayAPI(mutation, {
        boardId:  targetBoard,
        itemId:   parseInt(event.pulseId),
        columnId: selectedColumnId,
        value:    value,
      }, token);
      return `Status set to "${value}"`;
    }

    // ── ASSIGN PERSON ──
    case 'assign_person': {
      if (!selectedColumnId || !value) return 'No column or value — skipped';
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
            id
          }
        }
      `;
      await mondayAPI(mutation, {
        boardId:  targetBoard,
        itemId:   parseInt(event.pulseId),
        columnId: selectedColumnId,
        value:    JSON.stringify({ personsAndTeams: [{ id: parseInt(value), kind: 'person' }] }),
      }, token);
      return `Person assigned`;
    }

    // ── SET DATE ──
    case 'set_date': {
      if (!selectedColumnId) return 'No column — skipped';
      const dateVal = resolveDate(value || node.data?.dateOffset);
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
        }
      `;
      await mondayAPI(mutation, {
        boardId:  targetBoard,
        itemId:   parseInt(event.pulseId),
        columnId: selectedColumnId,
        value:    JSON.stringify({ date: dateVal }),
      }, token);
      return `Date set to ${dateVal}`;
    }

    // ── MOVE ITEM TO GROUP ──
    case 'move_item': {
      if (!selectedGroupId) return 'No group selected — skipped';
      const mutation = `
        mutation($itemId: ID!, $groupId: String!) {
          move_item_to_group(item_id: $itemId, group_id: $groupId) { id }
        }
      `;
      await mondayAPI(mutation, {
        itemId:  parseInt(event.pulseId),
        groupId: selectedGroupId,
      }, token);
      return `Item moved to group ${selectedGroupId}`;
    }

    // ── POST AN UPDATE ──
    case 'create_update': {
      const text = resolveTokens(message) || `Update from FlowMap automation`;
      const mutation = `
        mutation($itemId: ID!, $body: String!) {
          create_update(item_id: $itemId, body: $body) { id }
        }
      `;
      await mondayAPI(mutation, {
        itemId: parseInt(event.pulseId),
        body:   text,
      }, token);
      return `Update posted`;
    }

    // ── CREATE SUBITEM ──
    case 'create_subitem': {
      const name = resolveTokens(itemName) || `Subitem of ${event.pulseName}`;
      const mutation = `
        mutation($parentId: ID!, $itemName: String!) {
          create_subitem(parent_item_id: $parentId, item_name: $itemName) { id name }
        }
      `;
      const result = await mondayAPI(mutation, {
        parentId: parseInt(event.pulseId),
        itemName: name,
      }, token);
      return `Subitem created: "${result?.data?.create_subitem?.name}"`;
    }

    // ── ARCHIVE ITEM ──
    case 'archive_item': {
      const mutation = `
        mutation($itemId: ID!) {
          archive_item(item_id: $itemId) { id }
        }
      `;
      await mondayAPI(mutation, { itemId: parseInt(event.pulseId) }, token);
      return `Item archived`;
    }

    // ── DUPLICATE ITEM ──
    case 'duplicate_item': {
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $withUpdates: Boolean) {
          duplicate_item(board_id: $boardId, item_id: $itemId, with_updates: $withUpdates) { id name }
        }
      `;
      const result = await mondayAPI(mutation, {
        boardId:     targetBoard,
        itemId:      parseInt(event.pulseId),
        withUpdates: false,
      }, token);
      return `Item duplicated: "${result?.data?.duplicate_item?.name}"`;
    }

    default:
      return `Action "${templateId}" not yet implemented`;
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Core monday.com GraphQL caller
async function mondayAPI(query, variables, token) {
  const response = await axios.post(
    'https://api.monday.com/v2',
    { query, variables },
    {
      headers: {
        Authorization:  token,
        'Content-Type': 'application/json',
        'API-Version':  '2024-01',
      },
    }
  );
  if (response.data.errors) {
    throw new Error(response.data.errors.map(e => e.message).join(', '));
  }
  return response.data;
}

// Get a specific column value for an item
async function getItemColumnValue(itemId, columnId, token) {
  const query = `
    query($itemId: [ID!], $columnId: [String!]) {
      items(ids: $itemId) {
        column_values(ids: $columnId) {
          id text value
          ... on PeopleValue { persons_and_teams { id kind } }
        }
        group { id title }
      }
    }
  `;
  const data = await mondayAPI(query, {
    itemId:   [parseInt(itemId)],
    columnId: [columnId],
  }, token);
  return data?.data?.items?.[0]?.column_values?.[0];
}

// Get item details
async function getItem(itemId, token) {
  const query = `
    query($itemId: [ID!]) {
      items(ids: $itemId) { id name group { id title } board { id name } }
    }
  `;
  const data = await mondayAPI(query, { itemId: [parseInt(itemId)] }, token);
  return data?.data?.items?.[0];
}

// Map FlowMap trigger templateId → monday webhook event type
function mapTriggerToWebhookEvent(templateId) {
  const map = {
    status_changed:  'change_status_column_value',
    item_created:    'create_item',
    column_changes:  'change_column_value',
    item_assigned:   'change_column_value',
    button_clicked:  'change_column_value',
    item_moved:      'move_item_to_group',
    subitem_created: 'create_subitem',
    date_arrives:    'change_column_value',
    dependency_met:  'change_column_value',
  };
  return map[templateId] || null;
}

// Resolve date offset strings like "today", "today+3", "today-1"
function resolveDate(offset) {
  const today = new Date();
  if (!offset || offset === 'today') return today.toISOString().split('T')[0];
  const match = offset.match(/today([+-]\d+)/);
  if (match) {
    const days = parseInt(match[1]);
    today.setDate(today.getDate() + days);
  }
  return today.toISOString().split('T')[0];
}

// Add a log entry for a flow
function addLog(flowId, status, message) {
  if (!execLogs.has(flowId)) execLogs.set(flowId, []);
  const logs = execLogs.get(flowId);
  logs.push({ timestamp: new Date().toISOString(), status, message });
  if (logs.length > 100) logs.shift(); // keep last 100
}

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🗺️  FlowMap Backend running on http://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`   OAuth:     http://localhost:${PORT}/auth/monday`);
  console.log(`   Webhook:   http://localhost:${PORT}/webhook/monday/:flowId\n`);
});
