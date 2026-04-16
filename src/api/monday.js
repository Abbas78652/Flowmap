// src/api/monday.js
// All monday.com GraphQL queries used by FlowMap

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────
// Core fetcher
// ─────────────────────────────────────────────
export async function mondayQuery(query, variables = {}, token) {
  const res = await fetch(`${BACKEND_URL}/api/monday`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map(e => e.message).join(', '));
  return data.data;
}

// ─────────────────────────────────────────────
// GET CURRENT USER
// ─────────────────────────────────────────────
export async function getCurrentUser(token) {
  const query = `
    query {
      me {
        id name email photo_thumb
        account { id name plan { max_users } }
      }
    }
  `;
  const data = await mondayQuery(query, {}, token);
  return data.me;
}

// ─────────────────────────────────────────────
// GET WORKSPACES
// ─────────────────────────────────────────────
export async function getWorkspaces(token) {
  const query = `
    query {
      workspaces(limit: 100) {
        id name kind description
      }
    }
  `;
  const data = await mondayQuery(query, {}, token);
  return data.workspaces || [];
}

// ─────────────────────────────────────────────
// GET ALL BOARDS — lightweight fetch (no columns/groups)
// Columns/groups fetched separately when board is selected
// Small batches to avoid monday.com complexity limits
// ─────────────────────────────────────────────
export async function getBoards(token) {
  let allBoards = [];
  let page      = 1;
  const limit   = 50; // Small batches to stay under complexity limit

  while (true) {
    // Lightweight query — NO columns or groups (too heavy for 700+ boards)
    const query = `
      query GetBoards($limit: Int!, $page: Int!) {
        boards(limit: $limit, page: $page, order_by: created_at) {
          id
          name
          state
          board_kind
          workspace { id name }
        }
      }
    `;

    let batch = [];
    try {
      const data = await mondayQuery(query, { limit, page }, token);
      batch = data.boards || [];
    } catch (err) {
      console.error(`Error fetching boards page ${page}:`, err.message);
      break;
    }

    allBoards = [...allBoards, ...batch];

    if (batch.length < limit) break;
    if (page >= 30) break; // Safety cap — 30 × 50 = 1500 boards max
    page++;
  }

  const seen = new Set();
  return allBoards.filter(b => {
    if (!b.name || b.name.trim() === '')    return false;
    if (b.state !== 'active')               return false;
    if (b.board_kind === 'sub_items_board') return false;
    if (b.name.startsWith('Subitems of '))  return false;
    if (!b.workspace)                       return false;
    if (seen.has(b.id))                     return false;
    seen.add(b.id);
    return true;
  });
}

// ─────────────────────────────────────────────
// GET BOARD COLUMNS + GROUPS — called when user selects a board
// ─────────────────────────────────────────────
export async function getBoardDetails(boardId, token) {
  const query = `
    query GetBoard($boardId: [ID!]) {
      boards(ids: $boardId) {
        id name
        columns { id title type settings_str }
        groups  { id title color }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [boardId] }, token);
  return data.boards?.[0] || null;
}

// ─────────────────────────────────────────────
// GET WORKSPACE MEMBERS (for notify/assign)
// ─────────────────────────────────────────────
export async function getWorkspaceUsers(token) {
  const query = `
    query {
      users(limit: 200, kind: non_guests) {
        id name email photo_thumb title
      }
    }
  `;
  const data = await mondayQuery(query, {}, token);
  return data.users || [];
}



// ─────────────────────────────────────────────
// GET CONNECTED BOARDS
// ─────────────────────────────────────────────
export async function getConnectedBoards(boardId, token) {
  const query = `
    query GetLinkedBoards($boardId: [ID!]) {
      boards(ids: $boardId) {
        id name
        columns { id title type settings_str }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [boardId] }, token);
  const board = data.boards?.[0];
  if (!board) return [];
  const connected = [];
  for (const col of board.columns) {
    if (col.type === 'board_relation' || col.type === 'mirror') {
      try {
        const settings = JSON.parse(col.settings_str || '{}');
        if (settings.linkedPulseIds || settings.boardId) {
          connected.push({ columnId: col.id, columnTitle: col.title, columnType: col.type, targetBoardId: settings.boardId });
        }
      } catch (_) {}
    }
  }
  return connected;
}