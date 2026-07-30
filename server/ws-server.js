const http = require("http");
const { WebSocketServer } = require("ws");

const WS_PORT = 3006;

// Connected clients: { ws, userId, summonerName, tag }
const clients = new Map();
const draftSessions = new Map(); // sessionId -> { creatorUserId, side, currentStep, banned[], bluePicks[], redPicks[], spectators: Set<ws>, votes: Map<userId, compositionId> }

// Whiteboard subscribers: compositionId -> Set<ws>
const whiteboardSubscribers = new Map();

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", clients: clients.size }));
    return;
  }

  // Notify endpoint for API routes
  if (req.url === "/notify" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        // Broadcast to all composition subscribers
        if (data.type === "chat_message") {
          const payload = JSON.stringify({
            type: "chat_message",
            compositionId: data.compositionId,
            message: data.message,
          });
          for (const [, client] of clients) {
            if (client.ws.readyState === 1) {
              client.ws.send(payload);
            }
          }
        }
        // Broadcast data changes (notes, compositions)
        if (data.type === "data_changed") {
          broadcast({
            type: "data_changed",
            entity: data.entity,
            compositionId: data.compositionId,
          });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const [, client] of clients) {
    if (client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

function broadcastOnlineUsers() {
  const onlineUsers = [];
  for (const [, client] of clients) {
    if (client.ws.readyState === 1) {
      onlineUsers.push({
        userId: client.userId,
        summonerName: client.summonerName,
        tag: client.tag,
      });
    }
  }
  broadcast({ type: "online_users", users: onlineUsers });
}

function generateSessionId() {
  return Math.random().toString(16).substring(2, 10);
}

function broadcastToRoom(sessionId, message) {
  const session = draftSessions.get(sessionId);
  if (!session) return;
  const data = JSON.stringify(message);
  for (const spectator of session.spectators) {
    if (spectator.readyState === 1) {
      spectator.send(data);
    }
  }
}

/** Broadcast a message to ALL subscribers of a composition whiteboard, excluding sender. */
function broadcastToWhiteboard(compositionId, message, senderWs) {
  const subs = whiteboardSubscribers.get(compositionId);
  if (!subs) return;
  const data = JSON.stringify(message);
  for (const ws of subs) {
    if (ws !== senderWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

/** Get a serializable list of active draft sessions. */
function getActiveSessionsList() {
  const list = [];
  for (const [sessionId, session] of draftSessions) {
    for (const [ws, client] of clients) {
      if (client.userId === session.creatorUserId) {
        list.push({
          sessionId,
          creatorName: client.summonerName,
          creatorTag: client.tag,
          side: session.side,
          spectatorCount: session.spectators.size,
        });
        break;
      }
    }
  }
  return list;
}

wss.on("connection", (ws, req) => {
  let authenticated = false;
  let heartbeat;

  // Heartbeat timeout
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  heartbeat = setInterval(() => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Authentication message
      if (msg.type === "auth") {
        const jwt = require("jsonwebtoken");
        const secret = process.env.JWT_SECRET || "lol-tabtap-secret-koki-mill-2026";
        
        try {
          const payload = jwt.verify(msg.token, secret);
          authenticated = true;
          
          // Store client info
          clients.set(ws, {
            ws,
            userId: payload.userId,
            summonerName: payload.summonerName,
            tag: payload.tag,
            connectedAt: Date.now(),
          });

          ws.send(JSON.stringify({ type: "auth_ok", userId: payload.userId }));
          ws.send(JSON.stringify({ type: "draft_session_list", sessions: getActiveSessionsList() }));
          broadcastOnlineUsers();
        } catch {
          ws.send(JSON.stringify({ type: "auth_error", error: "Token inválido" }));
        }
        return;
      }

      // Authenticated messages
      if (!authenticated) {
        ws.send(JSON.stringify({ type: "error", error: "No autenticado" }));
        return;
      }

      switch (msg.type) {
        case "data_changed":
          // Broadcast to all OTHER clients
          const data = JSON.stringify({ type: "data_changed", entity: msg.entity, by: msg.by });
          for (const [otherWs, client] of clients) {
            if (otherWs !== ws && otherWs.readyState === 1) {
              otherWs.send(data);
            }
          }
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }

      // --- Whiteboard Handlers ---
      if (msg.type && msg.type.startsWith("wb:")) {
        const clientInfo = clients.get(ws);
        const userId = clientInfo ? clientInfo.userId : null;
        const userName = clientInfo ? clientInfo.summonerName : null;

        switch (msg.type) {
          case "wb:subscribe": {
            const compositionId = msg.compositionId;
            if (!compositionId) break;
            if (!whiteboardSubscribers.has(compositionId)) {
              whiteboardSubscribers.set(compositionId, new Set());
            }
            whiteboardSubscribers.get(compositionId).add(ws);
            break;
          }
          case "wb:unsubscribe": {
            const compositionId = msg.compositionId;
            if (!compositionId) break;
            const subs = whiteboardSubscribers.get(compositionId);
            if (subs) {
              subs.delete(ws);
              if (subs.size === 0) whiteboardSubscribers.delete(compositionId);
            }
            break;
          }
          case "wb:add": {
            const compositionId = msg.compositionId;
            broadcastToWhiteboard(compositionId, {
              type: "wb:element_added",
              element: msg.element,
              userId,
              userName,
            }, ws);
            break;
          }
          case "wb:move": {
            broadcastToWhiteboard(msg.compositionId, {
              type: "wb:element_moved",
              elementId: msg.elementId,
              x: msg.x,
              y: msg.y,
              userId,
              userName,
            }, ws);
            break;
          }
          case "wb:update": {
            broadcastToWhiteboard(msg.compositionId, {
              type: "wb:element_updated",
              element: msg.element,
              userId,
              userName,
            }, ws);
            break;
          }
          case "wb:remove": {
            broadcastToWhiteboard(msg.compositionId, {
              type: "wb:element_removed",
              elementId: msg.elementId,
              userId,
              userName,
            }, ws);
            break;
          }
          case "wb:lock": {
            broadcastToWhiteboard(msg.compositionId, {
              type: "wb:locked",
              elementId: msg.elementId,
              lockedBy: userId,
              userName,
              lock: msg.lock !== false,
            }, ws);
            break;
          }
          case "wb:unlock": {
            broadcastToWhiteboard(msg.compositionId, {
              type: "wb:locked",
              elementId: msg.elementId,
              lockedBy: null,
              userName: null,
              lock: false,
            }, ws);
            break;
          }
        }
        return;
      }

      // --- Draft Session Handlers ---
      const clientInfo = clients.get(ws);
      const userId = clientInfo ? clientInfo.userId : null;

      if (msg.type === "draft_create") {
        const sessionId = generateSessionId();
        const session = {
          creatorUserId: userId,
          side: msg.side,
          currentStep: 0,
          banned: [],
          bluePicks: [],
          redPicks: [],
          spectators: new Set([ws]),
          votes: new Map(),
        };
        draftSessions.set(sessionId, session);
        ws.send(JSON.stringify({
          type: "draft_created",
          sessionId,
          state: {
            side: msg.side,
            currentStep: 0,
            banned: [],
            bluePicks: [],
            redPicks: [],
          },
        }));
        // Broadcast to ALL clients that a new session is available
        if (clientInfo) {
          broadcast({
            type: "draft_session_created",
            sessionId,
            creatorName: clientInfo.summonerName,
            creatorTag: clientInfo.tag,
            side: msg.side,
            spectatorCount: 1,
          });
        }
        return;
      }

      if (msg.type === "draft_join") {
        const session = draftSessions.get(msg.sessionId);
        if (!session) {
          ws.send(JSON.stringify({ type: "error", error: "Sesión no encontrada" }));
          return;
        }
        session.spectators.add(ws);
        ws.send(JSON.stringify({
          type: "draft_state",
          sessionId: msg.sessionId,
          state: {
            side: session.side,
            currentStep: session.currentStep,
            banned: session.banned,
            bluePicks: session.bluePicks,
            redPicks: session.redPicks,
          },
          isCreator: userId === session.creatorUserId,
        }));
        broadcastToRoom(msg.sessionId, {
          type: "draft_spectators",
          sessionId: msg.sessionId,
          count: session.spectators.size,
        });
        return;
      }

      if (msg.type === "draft_leave") {
        const session = draftSessions.get(msg.sessionId);
        if (session) {
          session.spectators.delete(ws);
          if (userId && session.creatorUserId === userId) {
            // Creator leaves - end the session
            for (const spectator of session.spectators) {
              try {
                spectator.send(JSON.stringify({ type: "draft_ended", sessionId: msg.sessionId }));
              } catch (_) {}
            }
            draftSessions.delete(msg.sessionId);
            broadcast({ type: "draft_session_ended", sessionId: msg.sessionId });
          } else {
            broadcastToRoom(msg.sessionId, {
              type: "draft_spectators",
              sessionId: msg.sessionId,
              count: session.spectators.size,
            });
          }
        }
        return;
      }

      if (msg.type === "draft_creator_update") {
        const session = draftSessions.get(msg.sessionId);
        if (session && userId && session.creatorUserId === userId) {
          session.side = msg.state.side;
          session.currentStep = msg.state.currentStep;
          session.banned = msg.state.banned;
          session.bluePicks = msg.state.bluePicks;
          session.redPicks = msg.state.redPicks;
          for (const spectator of session.spectators) {
            if (spectator.readyState === 1) {
              const spectatorClient = clients.get(spectator);
              const isCreator = !!(spectatorClient && spectatorClient.userId === session.creatorUserId);
              spectator.send(JSON.stringify({
                type: "draft_state",
                sessionId: msg.sessionId,
                state: {
                  side: session.side,
                  currentStep: session.currentStep,
                  banned: session.banned,
                  bluePicks: session.bluePicks,
                  redPicks: session.redPicks,
                },
                isCreator,
              }));
            }
          }
        }
        return;
      }

      if (msg.type === "draft_vote") {
        const session = draftSessions.get(msg.sessionId);
        if (session && userId) {
          if (!session.votes.has(userId)) session.votes.set(userId, new Set());
          session.votes.get(userId).add(msg.compositionId);
          // Compute votes: count per compositionId across all users
          const votes = {};
          for (const [, compSet] of session.votes) {
            for (const compId of compSet) {
              votes[compId] = (votes[compId] || 0) + 1;
            }
          }
          broadcastToRoom(msg.sessionId, {
            type: "draft_votes",
            sessionId: msg.sessionId,
            votes,
          });
        }
        return;
      }

      if (msg.type === "draft_unvote") {
        const session = draftSessions.get(msg.sessionId);
        if (session && userId && session.votes.has(userId)) {
          if (msg.compositionId) {
            session.votes.get(userId).delete(msg.compositionId);
          } else {
            session.votes.delete(userId); // clear all votes
          }
          const votes = {};
          for (const [, compSet] of session.votes) {
            for (const compId of compSet) {
              votes[compId] = (votes[compId] || 0) + 1;
            }
          }
          broadcastToRoom(msg.sessionId, {
            type: "draft_votes",
            sessionId: msg.sessionId,
            votes,
          });
        }
        return;
      }

      if (msg.type === "draft_list") {
        ws.send(JSON.stringify({ type: "draft_session_list", sessions: getActiveSessionsList() }));
        return;
      }
    } catch (e) {
      console.error("WS message error:", e.message);
    }
  });

  ws.on("close", () => {
    const closedClient = clients.get(ws);
    const closedUserId = closedClient ? closedClient.userId : null;
    clearInterval(heartbeat);
    clients.delete(ws);
    // Clean up whiteboard subscribers
    for (const [compositionId, subs] of whiteboardSubscribers) {
      if (subs.has(ws)) {
        subs.delete(ws);
        if (subs.size === 0) whiteboardSubscribers.delete(compositionId);
      }
    }
    // Clean up draft sessions: remove this ws from all spectator sets
    for (const [sessionId, session] of draftSessions) {
      if (session.spectators.has(ws)) {
        session.spectators.delete(ws);
      }
      if (closedUserId && session.creatorUserId === closedUserId) {
        // Creator disconnected - end the session
        for (const spectator of session.spectators) {
          try {
            spectator.send(JSON.stringify({ type: "draft_ended", sessionId }));
          } catch (_) {}
        }
        draftSessions.delete(sessionId);
        broadcast({ type: "draft_session_ended", sessionId });
      }
    }
    if (authenticated) {
      broadcastOnlineUsers();
    }
  });

  ws.on("error", () => {
    clearInterval(heartbeat);
    clients.delete(ws);
  });
});

// Clean up dead connections periodically
setInterval(() => {
  for (const [ws] of clients) {
    if (ws.readyState !== 1) {
      clients.delete(ws);
    }
  }
}, 60000);

server.listen(WS_PORT, () => {
  console.log(`🌙 Team Ocaso WS Server running on port ${WS_PORT}`);
});
