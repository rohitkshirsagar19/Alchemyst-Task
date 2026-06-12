"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AGENT_WS_URL } from "@/lib/config/env";
import { buildUserMessage } from "@/lib/protocol/clientMessages";
import type { ClientMessage, ServerMessage } from "@/lib/protocol/types";
import {
  WebSocketManager,
  type InvalidSocketMessageEvent,
  type ParsedSocketMessageEvent,
  type WebSocketConnectionStatus,
} from "@/lib/websocket/websocketManager";
import { Panel } from "@/components/layout/Panel";

type DebugEntry =
  | {
      id: number;
      direction: "system";
      title: string;
      detail: string;
      timestamp: string;
    }
  | {
      id: number;
      direction: "outbound";
      title: ClientMessage["type"];
      detail: string;
      timestamp: string;
    }
  | {
      id: number;
      direction: "inbound";
      title: ServerMessage["type"];
      detail: string;
      timestamp: string;
    }
  | {
      id: number;
      direction: "invalid";
      title: "INVALID_MESSAGE";
      detail: string;
      timestamp: string;
    };

export function TransportDebugConsole() {
  const [status, setStatus] = useState<WebSocketConnectionStatus>("idle");
  const [draft, setDraft] = useState("hello");
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const managerRef = useRef<WebSocketManager | null>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    const manager = new WebSocketManager({
      url: AGENT_WS_URL,
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus);
      },
      onOpen: () => {
        appendSystemEntry("OPEN", `Connected to ${AGENT_WS_URL}`);
      },
      onMessage: (event) => {
        appendInboundEntry(event);
      },
      onInvalidMessage: (event) => {
        appendInvalidEntry(event);
      },
      onClose: (event) => {
        const detail = event.reason
          ? `Connection closed (${event.code}): ${event.reason}`
          : `Connection closed (${event.code})`;
        appendSystemEntry("CLOSE", detail);
      },
      onError: () => {
        appendSystemEntry("ERROR", "WebSocket reported an error event.");
      },
    });

    managerRef.current = manager;

    return () => {
      manager.disconnect();
      managerRef.current = null;
    };
  }, []);

  function appendSystemEntry(title: string, detail: string): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "system",
      title,
      detail,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendInboundEntry(event: ParsedSocketMessageEvent): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "inbound",
      title: event.message.type,
      detail: `${formatMessageSummary(event.message)}\nraw: ${event.raw}`,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendInvalidEntry(event: InvalidSocketMessageEvent): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "invalid",
      title: "INVALID_MESSAGE",
      detail: event.raw ? `${event.reason}\nraw: ${event.raw}` : event.reason,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendOutboundEntry(message: ClientMessage): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "outbound",
      title: message.type,
      detail: JSON.stringify(message, null, 2),
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendEntry(entry: DebugEntry): void {
    setEntries((current) => [entry, ...current].slice(0, 40));
  }

  function handleConnect(): void {
    managerRef.current?.connect();
  }

  function handleDisconnect(): void {
    managerRef.current?.disconnect();
  }

  function handleSend(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const content = draft.trim();
    if (!content) {
      return;
    }

    const message = buildUserMessage(content);
    const result = managerRef.current?.send(message);

    if (!result) {
      appendSystemEntry("ERROR", "WebSocket manager is not ready.");
      return;
    }

    if (!result.ok) {
      appendSystemEntry("SEND_BLOCKED", result.reason);
      return;
    }

    appendOutboundEntry(message);
    setDraft("");
  }

  const canConnect = status !== "connecting" && status !== "open";
  const canDisconnect = status === "connecting" || status === "open" || status === "error";
  const canSend = status === "open";

  return (
    <Panel
      title="Transport"
      description="WebSocket transport debug surface for protocol inspection."
      headerSlot={
        <div className="toolbar">
          <span className={`pill pill--status pill--${status}`}>{status}</span>
          <span className="pill">{AGENT_WS_URL}</span>
        </div>
      }
    >
      <div className="stack">
        <article className="card">
          <p className="card__label">Connection controls</p>
          <div className="button-row">
            <button type="button" className="control-button" onClick={handleConnect} disabled={!canConnect}>
              Connect
            </button>
            <button type="button" className="control-button control-button--muted" onClick={handleDisconnect} disabled={!canDisconnect}>
              Disconnect
            </button>
          </div>
        </article>

        <form className="composer" onSubmit={handleSend}>
          <label className="composer__label" htmlFor="message">
            USER_MESSAGE
          </label>
          <div className="composer__row">
            <input
              id="message"
              name="message"
              className="composer__input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a prompt for the agent server"
            />
            <button type="submit" className="composer__button" disabled={!canSend}>
              Send
            </button>
          </div>
        </form>

        <section className="debug-log">
          <div className="debug-log__header">
            <p className="card__label">Debug events</p>
            <p className="debug-log__meta">{entries.length} recent</p>
          </div>
          <div className="debug-log__entries">
            {entries.length === 0 ? (
              <article className="list-row">
                <p className="list-row__label">No events yet</p>
                <p className="list-row__detail">Connect to the backend and send a message to inspect raw protocol traffic.</p>
              </article>
            ) : (
              entries.map((entry) => (
                <article key={entry.id} className={`list-row list-row--${entry.direction}`}>
                  <div className="debug-log__entry-header">
                    <p className="list-row__label">{entry.title}</p>
                    <span className="debug-log__timestamp">{entry.timestamp}</span>
                  </div>
                  <pre className="debug-log__detail">{entry.detail}</pre>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </Panel>
  );
}

function formatMessageSummary(message: ServerMessage): string {
  return JSON.stringify(message, null, 2);
}
