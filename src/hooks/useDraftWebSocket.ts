"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DraftState } from "@/lib/draft";

export interface DraftWsState {
  sessionId: string | null;
  draftState: DraftState | null;
  isCreator: boolean;
  spectatorCount: number;
  votes: Record<number, number>;
  activeSessions: Array<{sessionId: string; creatorName: string; creatorTag: string; side: string; spectatorCount: number}>;
  refreshSessions: () => void;
}

export default function useDraftWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [activeSessions, setActiveSessions] = useState<Array<{sessionId: string; creatorName: string; creatorTag: string; side: string; spectatorCount: number}>>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);
  const pendingMessagesRef = useRef<Record<string, unknown>[]>([]);

  // ── Auto-connect on mount with reconnection ──
  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem("lolteam_token");
    if (!token) return;

    function connect() {
      if (!mountedRef.current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Use ws-lol.tabtap.dev in production (behind Cloudflare), localhost:3006 in dev
      const host = window.location.hostname === "lol.tabtap.dev" || window.location.hostname.endsWith(".tabtap.dev")
        ? "ws-lol.tabtap.dev"
        : `${window.location.hostname}:3006`;
      const url = `${protocol}//${host}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
        // Flush any messages queued before connection was ready
        for (const msg of pendingMessagesRef.current) {
          ws.send(JSON.stringify(msg));
        }
        pendingMessagesRef.current = [];
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!mountedRef.current) return;

          switch (msg.type) {
            case "auth_ok":
              setConnected(true);
              break;
            case "auth_error":
              console.error("WS auth error:", msg.error);
              ws.close();
              break;
            case "draft_created":
              setSessionId(msg.sessionId);
              setDraftState(msg.state);
              setIsCreator(true);
              break;
            case "draft_state":
              setSessionId(msg.sessionId);
              setDraftState(msg.state);
              setIsCreator(msg.isCreator);
              break;
            case "draft_spectators":
              setSpectatorCount(msg.count);
              break;
            case "draft_votes":
              setVotes(msg.votes || {});
              break;
            case "draft_session_list":
              setActiveSessions(msg.sessions || []);
              break;
            case "draft_session_created":
              setActiveSessions(prev => [...prev, { sessionId: msg.sessionId, creatorName: msg.creatorName, creatorTag: msg.creatorTag, side: msg.side, spectatorCount: msg.spectatorCount }]);
              break;
            case "draft_session_ended":
              setActiveSessions(prev => prev.filter(s => s.sessionId !== msg.sessionId));
              break;
            case "draft_ended":
              setSessionId(null);
              setDraftState(null);
              setIsCreator(false);
              setSpectatorCount(0);
              setVotes({});
              break;
            case "error":
              console.error("WS draft error:", msg.error);
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // ── Helpers ──
  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      // Queue for when connection is ready
      pendingMessagesRef.current.push(data);
    }
  }, []);

  // ── Actions ──
  const createSession = useCallback(
    (side: "blue" | "red") => {
      send({ type: "draft_create", side });
    },
    [send]
  );

  const joinSession = useCallback(
    (sid: string) => {
      send({ type: "draft_join", sessionId: sid });
    },
    [send]
  );

  const leaveSession = useCallback(() => {
    if (sessionId) {
      send({ type: "draft_leave", sessionId });
    }
    wsRef.current?.close();
  }, [send, sessionId]);

  const updateState = useCallback(
    (state: DraftState) => {
      send({ type: "draft_creator_update", sessionId, state });
    },
    [send, sessionId]
  );

  const vote = useCallback(
    (compositionId: number) => {
      send({ type: "draft_vote", sessionId, compositionId });
    },
    [send, sessionId]
  );

  const unvote = useCallback(
    (compositionId?: number) => {
      send({ type: "draft_unvote", sessionId, ...(compositionId !== undefined ? { compositionId } : {}) });
    },
    [send, sessionId]
  );

  const refreshSessions = useCallback(() => {
    send({ type: "draft_list" });
  }, [send]);

  return {
    connected,
    createSession,
    joinSession,
    leaveSession,
    updateState,
    vote,
    unvote,
    sessionId,
    draftState,
    isCreator,
    spectatorCount,
    votes,
    activeSessions,
    refreshSessions,
  };
}
