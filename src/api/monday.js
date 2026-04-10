// src/api/monday.js
// All monday.com GraphQL queries used by FlowMap

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────
// Core fetcher – sends queries through our backend proxy
// ─────────────────────────────────────────────
export async function mondayQuery(query, variables = {}, token) {
  const res = await fetch(`${BACKEND_URL}/api/monday`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
        id
        name
        email
        photo_thumb
        account {
          id
          name
          plan { max_users }
        }
      }
    }
  `;
  const data = await mondayQuery(query, {}, token);
  return data.me;
}

// ─────────────────────────────────────────────
// GET ALL BOARDS IN WORKSPACE
// ─────────────────────────────────────────────
export async function getBoards(token) {
  const query = `
    query {
      boards(limit: 50, order_by: created_at) {
        id
        name
        description
        state
        board_kind
        columns {
          id
          title
          type
          settings_str
        }
        groups {
          id
          title
          color
        }
        workspace {
          id
          name
        }
      }
    }
  `;
  const data = await mondayQuery(query, {}, token);
  return data.boards || [];
}

// ─────────────────────────────────────────────
// GET BOARD DETAILS + COLUMNS
// ─────────────────────────────────────────────
export async function getBoardDetails(boardId, token) {
  const query = `
    query GetBoard($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        description
        columns {
          id
          title
          type
          settings_str
        }
        groups {
          id
          title
          color
        }
        items_page(limit: 5) {
          items {
            id
            name
          }
        }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [boardId] }, token);
  return data.boards?.[0] || null;
}

// ─────────────────────────────────────────────
// GET AUTOMATIONS FOR BOARD(S)
// NOTE: monday.com's public API exposes automation rules
// via the 'rules' field (available on paid plans)
// ─────────────────────────────────────────────
export async function getBoardAutomations(boardIds, token) {
  // monday.com doesn't expose full automation internals via public API yet,
  // so we fetch board structure + simulate based on available metadata.
  // When the automations API becomes fully public, swap this query in:
  //
  // automations {
  //   id title status
  //   trigger { type columnId }
  //   actions { type targetBoardId columnMappings }
  // }

  const query = `
    query GetBoardsWithColumns($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        id
        name
        columns {
          id
          title
          type
          settings_str
        }
        groups {
          id
          title
          color
        }
      }
    }
  `;
  const data = await mondayQuery(query, { boardIds }, token);
  return data.boards || [];
}

// ─────────────────────────────────────────────
// GET WORKSPACES
// ─────────────────────────────────────────────
export async function getWorkspaces(token) {
  const query = `
    query {
      workspaces {
        id
        name
        kind
        description
      }
    }
  `;
  const data = await mondayQuery(query, {}, token);
  return data.workspaces || [];
}

// ─────────────────────────────────────────────
// GET CONNECTED BOARDS (via mirror/linked columns)
// ─────────────────────────────────────────────
export async function getConnectedBoards(boardId, token) {
  const query = `
    query GetLinkedBoards($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        columns {
          id
          title
          type
          settings_str
        }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [boardId] }, token);
  const board = data.boards?.[0];
  if (!board) return [];

  // Parse mirror/link columns to find connected board IDs
  const connected = [];
  for (const col of board.columns) {
    if (col.type === 'board_relation' || col.type === 'mirror') {
      try {
        const settings = JSON.parse(col.settings_str || '{}');
        if (settings.linkedPulseIds || settings.boardId) {
          connected.push({
            columnId: col.id,
            columnTitle: col.title,
            columnType: col.type,
            targetBoardId: settings.boardId,
          });
        }
      } catch (_) {}
    }
  }
  return connected;
}
