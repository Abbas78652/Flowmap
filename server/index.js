// server/index.js — FlowMap Backend with Supabase persistence
/* eslint-disable no-unused-vars */

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
require('dotenv').config();

// ─────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─────────────────────────────────────────────
// MAILJET EMAIL SENDER
// ─────────────────────────────────────────────
async function sendMailjetEmail({ to, subject, body }) {
  const apiKey    = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_API_SECRET;
  const fromEmail = process.env.MAILJET_FROM_EMAIL || 'noreply@flowmap.app';
  const fromName  = process.env.MAILJET_FROM_NAME  || 'FlowMap Automation';
  if (!apiKey || !apiSecret) throw new Error('Mailjet credentials not configured.');
  const response = await axios.post(
    'https://api.mailjet.com/v3.1/send',
    {
      Messages: [{
        From:     { Email: fromEmail, Name: fromName },
        To:       [{ Email: to }],
        Subject:  subject,
        TextPart: body,
        HTMLPart: `<div style='font-family:sans-serif;'>${body.replace(/\n/g, '<br>')}</div>`,
      }],
    },
    { auth: { username: apiKey, password: apiSecret } }
  );
  return response.data;
}

// ─────────────────────────────────────────────
// EXPRESS SETUP
// ─────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'FlowMap', version: '1.0.0', storage: 'supabase' });
});

// ─────────────────────────────────────────────
// OAUTH — monday.com
// ─────────────────────────────────────────────
app.get('/auth/monday', (req, res) => {
  const clientId    = process.env.REACT_APP_MONDAY_CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;
  const authUrl     = `https://auth.monday.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  try {
    const response = await axios.post('https://auth.monday.com/oauth2/token', {
      client_id:     process.env.REACT_APP_MONDAY_CLIENT_ID,
      client_secret: process.env.MONDAY_CLIENT_SECRET,
      code,
      redirect_uri:  process.env.REDIRECT_URI,
    });
    const { access_token } = response.data;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?token=${access_token}`);
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

// ─────────────────────────────────────────────
// MONDAY.COM API PROXY
// ─────────────────────────────────────────────
app.post('/api/monday', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      req.body,
      { headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' } }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// AI AUDIT
// ─────────────────────────────────────────────
app.post('/api/audit', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
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
    const result = response.data.content?.[0]?.text || 'No response';
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// FLOWS API — Supabase backed
// ─────────────────────────────────────────────

// Get all flows for a user
app.get('/api/flows', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const user = await getMondayUser(token);
    const { data, error } = await supabase
      .from('flows')
      .select('*')
      .eq('account_id', user.account.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ flows: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save / update a flow
app.post('/api/flows/save', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { flow } = req.body;
  if (!flow) return res.status(400).json({ error: 'No flow provided' });
  try {
    const user = await getMondayUser(token);
    const { data, error } = await supabase
      .from('flows')
      .upsert({
        id:         flow.id,
        user_id:    user.id,
        account_id: user.account.id,
        name:       flow.name,
        nodes:      flow.nodes,
        edges:      flow.edges,
        active:     flow.active || false,
        webhook_ids: flow.webhookIds || [],
      }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, flow: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a flow
app.delete('/api/flows/:flowId', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const user = await getMondayUser(token);
    const { error } = await supabase
      .from('flows')
      .delete()
      .eq('id', req.params.flowId)
      .eq('user_id', user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// ACTIVATE FLOW — register monday webhooks
// ─────────────────────────────────────────────
app.post('/api/flows/activate', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { flow } = req.body;
  if (!flow) return res.status(400).json({ error: 'No flow provided' });

  const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || `http://localhost:${PORT}`;
  const webhooks = [];
  const errors   = [];

  const triggerNodes = flow.nodes?.filter(n => n.data?.nodeType === 'trigger') || [];
  if (triggerNodes.length === 0) return res.status(400).json({ success: false, error: 'No trigger nodes in flow' });

  for (const triggerNode of triggerNodes) {
    const { templateId, selectedBoardId } = triggerNode.data || {};
    if (!selectedBoardId) { errors.push(`Trigger "${triggerNode.data?.label}": no board selected`); continue; }

    const eventType = templateIdToEventType(templateId);
    if (!eventType) { errors.push(`Trigger "${templateId}": not yet supported as webhook`); continue; }

    try {
      const mutation = `
        mutation($boardId: ID!, $url: String!, $event: WebhookEventType!) {
          create_webhook(board_id: $boardId, url: $url, event: $event) {
            id board_id
          }
        }
      `;
      const url  = `${WEBHOOK_BASE_URL}/webhook/${flow.id}`;
      const data = await mondayAPI(mutation, { boardId: selectedBoardId, url, event: eventType }, token);
      if (data?.create_webhook?.id) {
        webhooks.push({ id: data.create_webhook.id, boardId: selectedBoardId, event: eventType, nodeId: triggerNode.id });
      }
    } catch (err) {
      errors.push(`Webhook registration failed: ${err.message}`);
    }
  }

  if (webhooks.length === 0 && errors.length > 0) {
    return res.json({ success: false, error: errors[0], errors });
  }

  // Store in Supabase
  try {
    const user = await getMondayUser(token);
    await supabase.from('flows').upsert({
      id:           flow.id,
      user_id:      user.id,
      account_id:   user.account.id,
      name:         flow.name,
      nodes:        flow.nodes,
      edges:        flow.edges,
      active:       true,
      webhook_ids:  webhooks,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('Supabase save error:', err.message);
  }

  res.json({ success: true, webhooks, errors });
});

// ─────────────────────────────────────────────
// DEACTIVATE FLOW — delete monday webhooks
// ─────────────────────────────────────────────
app.post('/api/flows/deactivate', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { flowId } = req.body;

  try {
    // Get flow from Supabase
    const { data: flow } = await supabase.from('flows').select('*').eq('id', flowId).single();

    if (flow?.webhook_ids?.length > 0) {
      for (const wh of flow.webhook_ids) {
        try {
          const mutation = `mutation($id: ID!) { delete_webhook(id: $id) { id } }`;
          await mondayAPI(mutation, { id: wh.id }, token);
        } catch (err) {
          console.error('Webhook delete error:', err.message);
        }
      }
    }

    await supabase.from('flows').update({ active: false, webhook_ids: [] }).eq('id', flowId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook receiver moved to workflow block section above

// ─────────────────────────────────────────────
// EXECUTION LOGS
// ─────────────────────────────────────────────
app.get('/api/flows/:flowId/logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('execution_logs')
      .select('*')
      .eq('flow_id', req.params.flowId)
      .order('timestamp', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ logs: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// WORKFLOW BLOCK ENDPOINTS (for "something" fix)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// WORKFLOW AUTOMATION BLOCK ENDPOINTS
// These replace bare webhooks — shows real values in monday UI
// ─────────────────────────────────────────────

// monday calls this when user adds our trigger block to a workflow
// payload.inputFields contains the ACTUAL selected values (board, column, status)
app.post('/workflow/subscribe', async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ error: 'No payload' });

    const {
      webhookUrl,
      subscriptionId,
      inputFields    = {},
      inboundFieldValues = {},
    } = payload;

    const fields = { ...inboundFieldValues, ...inputFields };

    // Extract the Authorization header JWT — contains the monday token
    const authHeader = req.headers['authorization'] || '';
    // Store subscription in Supabase for persistence across Render restarts
    const { error } = await supabase.from('subscriptions').upsert({
      id:           String(subscriptionId),
      flow_id:      null,
      webhook_url:  webhookUrl,
      input_fields: fields,
      board_id:     String(fields.boardId || fields.board_id || ''),
      token:        authHeader.replace('Bearer ', ''),
    }, { onConflict: 'id' });

    if (error) {
      console.error('Subscribe DB error:', error.message);
      // Still return success — don't block monday
    }

    console.log(`✅ Workflow subscribed: ${subscriptionId}`, JSON.stringify(fields));
    res.status(200).json({ webhookId: subscriptionId });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    // Return 200 even on error — monday retries on non-200
    res.status(200).json({ webhookId: req.body?.payload?.subscriptionId });
  }
});

// monday calls this when user removes/disables our trigger block
app.post('/workflow/unsubscribe', async (req, res) => {
  try {
    const { payload } = req.body;
    const webhookId = payload?.webhookId;
    if (webhookId) {
      await supabase.from('subscriptions').delete().eq('id', String(webhookId));
      console.log(`✅ Workflow unsubscribed: ${webhookId}`);
    }
    res.status(200).json({});
  } catch (err) {
    console.error('Unsubscribe error:', err.message);
    res.status(200).json({});
  }
});

// monday calls this to execute our ACTION block
app.post('/workflow/execute', async (req, res) => {
  try {
    const { payload } = req.body;
    console.log('Workflow execute:', JSON.stringify(payload));
    // Future: implement action block execution here
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(200).json({ success: true });
  }
});

// monday fires this when a workflow trigger condition is met
// Our subscription's webhookUrl gets called by monday directly
// This endpoint handles status changes from our OWN registered webhooks
app.post('/webhook/:flowId', async (req, res) => {
  if (req.body?.challenge) return res.json({ challenge: req.body.challenge });
  res.json({ received: true });

  const { flowId } = req.params;
  const event = req.body?.event || req.body;

  try {
    const { data: flow } = await supabase.from('flows').select('*').eq('id', flowId).single();
    if (!flow || !flow.active) return;

    const token = await getTokenForAccount(flow.account_id);
    if (!token) { console.error('No token for account', flow.account_id); return; }

    await executeFlow({ flow, event, token });
  } catch (err) {
    console.error('Webhook execution error:', err.message);
  }
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Token cache — stores token per account (populated on webhook activation)
const tokenCache = new Map();

async function getTokenForAccount(accountId) {
  return tokenCache.get(accountId) || null;
}

async function getMondayUser(token) {
  const res = await axios.post(
    'https://api.monday.com/v2',
    { query: `query { me { id name email account { id name } } }` },
    { headers: { Authorization: token, 'Content-Type': 'application/json' } }
  );
  const user = res.data?.data?.me;
  if (user) tokenCache.set(String(user.account.id), token);
  return user;
}

async function mondayAPI(query, variables, token) {
  const res = await axios.post(
    'https://api.monday.com/v2',
    { query, variables },
    { headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-01' } }
  );
  if (res.data?.errors) throw new Error(res.data.errors.map(e => e.message).join(', '));
  return res.data?.data;
}

function templateIdToEventType(templateId) {
  const map = {
    status_changed:  'change_status_column_value',
    item_created:    'create_pulse',
    column_changes:  'change_column_value',
    item_assigned:   'change_column_value',
    subitem_created: 'create_subitem',
    item_moved:      'move_pulse_into_board',
    date_arrives:    'item_archived',
  };
  return map[templateId] || null;
}

async function getItemColumnValue(itemId, columnId, token) {
  try {
    const q = `query($itemId: [ID!], $colId: [String!]) {
      items(ids: $itemId) { column_values(ids: $colId) { value text } }
    }`;
    const data = await mondayAPI(q, { itemId: [String(itemId)], colId: [columnId] }, token);
    const raw  = data?.items?.[0]?.column_values?.[0]?.value;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// FLOW EXECUTOR
// ─────────────────────────────────────────────
async function executeFlow({ flow, event, token }) {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

  const triggerNodes = nodes.filter(n => n.data?.nodeType === 'trigger');
  let matchedTrigger = null;

  for (const t of triggerNodes) {
    if (t.data?.templateId === 'status_changed') {
      const colMatches = !t.data?.selectedColumnId || t.data.selectedColumnId === event.columnId;
      const valMatches = !t.data?.value ||
        String(event.value?.index) === String(t.data.value) ||
        event.value?.label?.text === t.data.value;
      if (colMatches && valMatches) { matchedTrigger = t; break; }
    } else {
      matchedTrigger = t;
      break;
    }
  }

  if (!matchedTrigger) {
    await logExecution(flow.id, flow.account_id, 'trigger_no_match', 'Trigger condition not met — skipped');
    return;
  }

  await logExecution(flow.id, flow.account_id, 'trigger_matched', `Trigger fired: ${matchedTrigger.data?.label}`);

  // BFS traversal from trigger
  const visited = new Set();
  const queue   = [matchedTrigger.id];

  while (queue.length > 0) {
    const nodeId    = queue.shift();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data?.nodeType === 'trigger') {
      const nextIds = edges.filter(e => e.source === nodeId).map(e => e.target);
      queue.push(...nextIds);
      continue;
    }

    if (node.data?.nodeType === 'condition') {
      const passes = await evaluateCondition(node, event, token);
      if (!passes) {
        await logExecution(flow.id, flow.account_id, 'condition_failed', `Condition "${node.data?.label}" not met — stopped`);
        break;
      }
      await logExecution(flow.id, flow.account_id, 'condition_passed', `Condition "${node.data?.label}" passed`);
    }

    if (node.data?.nodeType === 'action') {
      try {
        const result = await executeAction(node, event, token);
        await logExecution(flow.id, flow.account_id, 'action_success', `✅ ${node.data?.label}: ${result}`);
      } catch (err) {
        await logExecution(flow.id, flow.account_id, 'action_error', `❌ ${node.data?.label}: ${err.message}`);
      }
    }

    const nextIds = edges.filter(e => e.source === nodeId).map(e => e.target);
    queue.push(...nextIds);
  }
}

async function logExecution(flowId, accountId, status, message) {
  try {
    await supabase.from('execution_logs').insert({ flow_id: flowId, account_id: accountId, status, message });
  } catch (err) {
    console.error('Log error:', err.message);
  }
}

async function evaluateCondition(node, event, token) {
  const { templateId, selectedColumnId, value, selectedBoardId } = node.data || {};
  if (templateId === 'no_condition') return true;
  if (templateId === 'status_is') {
    const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
    return String(colVal?.index) === String(value) || colVal?.label?.text === value;
  }
  if (templateId === 'checkbox_checked') {
    const colVal = await getItemColumnValue(event.pulseId, selectedColumnId, token);
    return colVal?.checked === true || colVal === true;
  }
  return true;
}

function resolveTokens(text, event) {
  if (!text) return text;
  return text
    .replace(/\{Item Name\}/g,    event.pulseName || '')
    .replace(/\{Item ID\}/g,      event.pulseId   || '')
    .replace(/\{Board Name\}/g,   event.boardName || '')
    .replace(/\{Group Name\}/g,   event.groupId   || '')
    .replace(/\{Today\}/g,        new Date().toISOString().split('T')[0])
    .replace(/\{Triggered By\}/g, event.userId    || '');
}

async function executeAction(node, event, token) {
  const { templateId, selectedBoardId, selectedColumnId, selectedGroupId,
          selectedPersonId, value, message, itemName, emailTo, emailSubject,
          dateOffset } = node.data || {};

  const targetBoard = selectedBoardId || event.boardId;
  const msg         = resolveTokens(message, event);
  const iName       = resolveTokens(itemName, event);

  switch (templateId) {

    case 'create_item': {
      if (!targetBoard) return 'No board selected — skipped';
      const mutation = `
        mutation($boardId: ID!, $itemName: String!, $groupId: String) {
          create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId) { id }
        }
      `;
      const data = await mondayAPI(mutation, {
        boardId: targetBoard, itemName: iName || `Item from FlowMap`, groupId: selectedGroupId || null
      }, token);
      return `Item created: ${data?.create_item?.id}`;
    }

    case 'notify_someone': {
      const text   = msg || `FlowMap automation triggered for: ${event.pulseName}`;
      const userId = selectedPersonId || event.userId;
      if (!userId) return 'No recipient — skipped';
      const mutation = `
        mutation($userId: ID!, $text: String!, $itemId: ID!) {
          create_notification(user_id: $userId, target_id: $itemId, text: $text, target_type: Project) { text }
        }
      `;
      await mondayAPI(mutation, { userId: parseInt(userId), text, itemId: parseInt(event.pulseId) }, token);
      return `Notification sent to user ${userId}`;
    }

    case 'send_email': {
      const to      = resolveTokens(emailTo, event);
      const subject = resolveTokens(emailSubject, event) || 'FlowMap Automation Notification';
      const body    = msg || `Automation triggered for: ${event.pulseName}`;
      if (!to) return 'No recipient email — skipped';
      await sendMailjetEmail({ to, subject, body });
      return `Email sent to ${to}`;
    }

    case 'set_status': {
      if (!selectedColumnId || !value) return 'No column or value — skipped';
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
        }
      `;
      await mondayAPI(mutation, {
        boardId:  targetBoard, itemId: parseInt(event.pulseId),
        columnId: selectedColumnId, value: JSON.stringify({ index: parseInt(value) }),
      }, token);
      return `Status set (index: ${value})`;
    }

    case 'assign_person': {
      if (!selectedColumnId) return 'No column — skipped';
      const personId = selectedPersonId || value;
      if (!personId) return 'No person selected — skipped';
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
        }
      `;
      await mondayAPI(mutation, {
        boardId:  targetBoard, itemId: parseInt(event.pulseId),
        columnId: selectedColumnId,
        value:    JSON.stringify({ personsAndTeams: [{ id: parseInt(personId), kind: 'person' }] }),
      }, token);
      return `Person ${personId} assigned`;
    }

    case 'move_item': {
      if (!selectedGroupId) return 'No group selected — skipped';
      const mutation = `
        mutation($itemId: ID!, $groupId: String!, $boardId: ID!) {
          move_item_to_group(item_id: $itemId, group_id: $groupId) { id }
        }
      `;
      await mondayAPI(mutation, { itemId: parseInt(event.pulseId), groupId: selectedGroupId, boardId: targetBoard }, token);
      return `Item moved to group ${selectedGroupId}`;
    }

    case 'set_date': {
      if (!selectedColumnId) return 'No column — skipped';
      const offset = parseInt(dateOffset) || 0;
      const d      = new Date(); d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
        }
      `;
      await mondayAPI(mutation, {
        boardId:  targetBoard, itemId: parseInt(event.pulseId),
        columnId: selectedColumnId, value: JSON.stringify({ date: dateStr }),
      }, token);
      return `Date set to ${dateStr}`;
    }

    case 'create_update': {
      const text = msg || `Update from FlowMap automation`;
      const mutation = `
        mutation($itemId: ID!, $body: String!) {
          create_update(item_id: $itemId, body: $body) { id }
        }
      `;
      await mondayAPI(mutation, { itemId: parseInt(event.pulseId), body: text }, token);
      return `Update posted`;
    }

    case 'archive_item': {
      const mutation = `
        mutation($itemId: ID!) { archive_item(item_id: $itemId) { id } }
      `;
      await mondayAPI(mutation, { itemId: parseInt(event.pulseId) }, token);
      return `Item archived`;
    }

    case 'create_subitem': {
      const mutation = `
        mutation($parentId: ID!, $itemName: String!) {
          create_subitem(parent_item_id: $parentId, item_name: $itemName) { id }
        }
      `;
      await mondayAPI(mutation, {
        parentId: parseInt(event.pulseId),
        itemName: iName || `Subitem from FlowMap`,
      }, token);
      return `Subitem created`;
    }

    case 'duplicate_item': {
      const mutation = `
        mutation($boardId: ID!, $itemId: ID!, $withPinned: Boolean) {
          duplicate_item(board_id: $boardId, item_id: $itemId, with_pinned_items: $withPinned) { id }
        }
      `;
      await mondayAPI(mutation, {
        boardId:     targetBoard,
        itemId:      parseInt(event.pulseId),
        withPinned:  false,
      }, token);
      return `Item duplicated`;
    }

    default:
      return `Action "${templateId}" not implemented`;
  }
}

app.listen(PORT, () => {
  console.log(`FlowMap backend running on port ${PORT}`);
  console.log(`Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`Mailjet:  ${process.env.MAILJET_API_KEY ? '✅ Configured' : '⚠️ Not configured'}`);
  console.log(`Anthropic:${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '⚠️ Not configured'}`);
});