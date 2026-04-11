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
// GET ALL BOARDS — paginated, filtered
// ─────────────────────────────────────────────
export async function getBoards(token) {
  // Fetch first page
  let allBoards = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const query = `
      query GetBoards($limit: Int!, $page: Int!) {
        boards(limit: $limit, page: $page, order_by: created_at) {
          id name state board_kind
          columns { id title type settings_str }
          groups { id title color }
          workspace { id name }
        }
      }
    `;
    const data = await mondayQuery(query, { limit, page }, token);
    const batch = data.boards || [];
    allBoards = [...allBoards, ...batch];

    // Stop if we got fewer than limit (last page)
    if (batch.length < limit) break;
    // Safety cap at 10 pages (1000 boards)
    if (page >= 10) break;
    page++;
  }

  // Filter:
  // 1. Only active boards
  // 2. Remove subitem boards (board_kind = 'sub_items_board' or name starts with 'Subitems of')
  // 3. Remove share/template boards
  // 4. Must have a workspace
  return allBoards.filter(b =>
    b.state === 'active' &&
    b.board_kind !== 'share' &&
    b.board_kind !== 'sub_items_board' &&
    !b.name.startsWith('Subitems of') &&
    b.workspace !== null &&
    b.workspace !== undefined
  );
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
// GET BOARD DETAILS
// ─────────────────────────────────────────────
export async function getBoardDetails(boardId, token) {
  const query = `
    query GetBoard($boardId: [ID!]) {
      boards(ids: $boardId) {
        id name
        columns { id title type settings_str }
        groups { id title color }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [boardId] }, token);
  return data.boards?.[0] || null;
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