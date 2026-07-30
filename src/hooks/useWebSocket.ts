"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface OnlineUser {
  userId: number;
  summonerName: string;
  tag: string;
}

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

type WsListener = (msg: WsMessage) => void;

export default function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const listenersRef = useRef<Set<WsListener>>(new Set());

  const addListener = useCallback((fn: WsListener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) return;

    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      // Try direct WS connection first
      const url = `${protocol}//${host}:3006`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        // Authenticate
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "auth_ok":
              setConnected(true);
              break;
            case "auth_error":
              console.error("WS auth error:", msg.error);
              ws.close();
              break;
            case "online_users":
              // Deduplicate by userId
              const unique = new Map<number, OnlineUser>();
              for (const u of (msg.users || [])) {
                if (!unique.has(u.userId)) unique.set(u.userId, u);
              }
              setOnlineUsers(Array.from(unique.values()));
              break;
            case "data_changed":
              // Notify listeners (pages will refetch)
              listenersRef.current.forEach((fn) => fn(msg));
              break;
            default:
              listenersRef.current.forEach((fn) => fn(msg));
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 3s
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const notifyChange = useCallback((entity: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const user = localStorage.getItem("lolteam_user");
      const parsed = user ? JSON.parse(user) : null;
      wsRef.current.send(
        JSON.stringify({
          type: "data_changed",
          entity,
          by: parsed?.summonerName || "unknown",
        })
      );
    }
  }, []);

  return { connected, onlineUsers, notifyChange, addListener };
}
