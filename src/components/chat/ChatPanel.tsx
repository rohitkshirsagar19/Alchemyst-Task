"use client";

import type { FormEvent } from "react";
import { useEffect, useReducer, useRef, useState } from "react";
import { AssistantStream } from "@/components/chat/AssistantStream";
import { MessageInput } from "@/components/chat/MessageInput";
import { TransportDebugConsole, type DebugEntry } from "@/components/chat/TransportDebugConsole";
import { Panel } from "@/components/layout/Panel";
import { AGENT_WS_URL } from "@/lib/config/env";
import { buildUserMessage } from "@/lib/protocol/clientMessages";
import { createOrderingBuffer, type OrderedPushResult } from "@/lib/protocol/orderingBuffer";
import type { ClientMessage, ServerMessage } from "@/lib/protocol/types";
import { agentReducer, initialAgentState, type ChatMessage } from "@/lib/store/agentStore";
import { selectChatMessages } from "@/lib/store/selectors";
import {
  WebSocketManager,
  type InvalidSocketMessageEvent,
  type OutboundSocketMessageEvent,
  type ParsedSocketMessageEvent,
  type WebSocketConnectionStatus,
} from "@/lib/websocket/websocketManager";

export function ChatPanel() {
  const [status, setStatus] = useState<WebSocketConnectionStatus>("idle");
  const [draft, setDraft] = useState("hello");
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [state, dispatch] = useReducer(agentReducer, initialAgentState);
  const managerRef = useRef<WebSocketManager | null>(null);
  const nextIdRef = useRef(1);
  const userMessageCountRef = useRef(1);
  const orderingBufferRef = useRef(createOrderingBuffer({ initialExpectedSeq: 1 }));

  useEffect(() => {
    const manager = new WebSocketManager({
      url: AGENT_WS_URL,
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus);
      },
      onOpen: () => {
        orderingBufferRef.current.reset({ initialExpectedSeq: 1 });
        appendSystemEntry("OPEN", `Connected to ${AGENT_WS_URL}`);
        appendSystemEntry("ORDERING_RESET", "Ordering buffer reset for a new connection. Expected seq = 1.");
      },
      onMessage: (event) => {
        appendReceivedEntry(event);
        const result = orderingBufferRef.current.push(event.message);
        appendOrderingOutcome(result);
        if (result.processed.length > 0) {
          dispatch({
            type: "APPLY_PROCESSED_MESSAGES",
            messages: result.processed,
          });
        }
      },
      onSend: (event) => {
        appendOutboundEntry(event);
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

  const messages = selectChatMessages(state);
  const canConnect = status !== "connecting" && status !== "open";
  const canDisconnect = status === "connecting" || status === "open" || status === "error";
  const canSend = status === "open";

  function appendEntry(entry: DebugEntry): void {
    setEntries((current) => [entry, ...current].slice(0, 120));
  }

  function appendSystemEntry(title: string, detail: string): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "system",
      title,
      detail,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendReceivedEntry(event: ParsedSocketMessageEvent): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "received",
      title: `RECEIVED ${event.message.type}`,
      detail: formatReceivedDetail(event),
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendProcessedEntry(message: ServerMessage): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "processed",
      title: `PROCESSED ${message.type}`,
      detail: `${JSON.stringify(message, null, 2)}\nlastFullyProcessedSeq: ${orderingBufferRef.current.getLastFullyProcessedSeq()}`,
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

  function appendOutboundEntry(event: OutboundSocketMessageEvent): void {
    appendEntry({
      id: nextIdRef.current++,
      direction: "outbound",
      title: event.message.type,
      detail: formatOutboundDetail(event),
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  function appendOrderingOutcome(result: OrderedPushResult): void {
    if (result.accepted === "buffered") {
      appendSystemEntry(
        "BUFFERED",
        `Buffered seq ${result.receivedSeq}. Waiting for seq ${result.expectedSeq}. bufferedCount=${result.bufferedCount}`,
      );
      return;
    }

    if (result.accepted === "duplicate") {
      appendSystemEntry(
        "DUPLICATE_IGNORED",
        `Ignored seq ${result.receivedSeq}. expectedSeq=${result.expectedSeq} bufferedCount=${result.bufferedCount}`,
      );
      return;
    }

    for (const message of result.processed) {
      appendProcessedEntry(message);
    }
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

    dispatch({
      type: "ADD_USER_MESSAGE",
      message: {
        id: `user-${userMessageCountRef.current++}`,
        role: "user",
        content,
        status: "ended",
      },
    });

    orderingBufferRef.current.reset({ initialExpectedSeq: 1 });
    appendSystemEntry("ORDERING_RESET", "Ordering buffer reset for a new server turn. Expected seq = 1.");
    setDraft("");
  }

  return (
    <Panel
      title="Chat Panel"
      description="Streaming assistant renderer backed by the ordered protocol event stream."
      headerSlot={
        <div className="toolbar">
          <span className={`pill pill--status pill--${status}`}>{status}</span>
          <span className="pill">{AGENT_WS_URL}</span>
          <span className="pill">next seq {orderingBufferRef.current.getExpectedSeq()}</span>
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

        <section className="chat-transcript">
          <div className="chat-transcript__header">
            <p className="card__label">Conversation</p>
            <p className="debug-log__meta">{messages.length} messages</p>
          </div>
          <div className="chat-transcript__messages">
            {messages.length === 0 ? (
              <article className="list-row">
                <p className="list-row__label">No conversation yet</p>
                <p className="list-row__detail">Send a prompt to start a streamed assistant response.</p>
              </article>
            ) : (
              messages.map((message) => (
                message.role === "assistant" ? (
                  <AssistantStream key={message.id} message={message} />
                ) : (
                  <UserMessageBubble key={message.id} message={message} />
                )
              ))
            )}
          </div>
        </section>

        <MessageInput
          disabled={!canSend}
          onChange={setDraft}
          onSubmit={handleSend}
          value={draft}
        />

        <TransportDebugConsole
          entries={entries}
          footer={<p className="debug-log__meta">Chat rendering currently uses ordered TOKEN and STREAM_END events only.</p>}
        />
      </div>
    </Panel>
  );
}

function UserMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article className="chat-bubble chat-bubble--user">
      <div className="chat-bubble__meta">
        <span>User</span>
      </div>
      <p className="chat-bubble__text">{message.content}</p>
    </article>
  );
}

function formatReceivedDetail(event: ParsedSocketMessageEvent): string {
  if (event.message.type === "PING" && event.message.challenge === "") {
    return `corrupt heartbeat: empty challenge\n${JSON.stringify(event.message, null, 2)}\nraw: ${event.raw}`;
  }

  return `${JSON.stringify(event.message, null, 2)}\nraw: ${event.raw}`;
}

function formatOutboundDetail(event: OutboundSocketMessageEvent): string {
  if (event.message.type === "PONG") {
    const prefix = event.message.echo === ""
      ? "heartbeat response to empty challenge"
      : `heartbeat response (${event.source})`;

    return `${prefix}\n${JSON.stringify(event.message, null, 2)}`;
  }

  return `${event.source} send\n${JSON.stringify(event.message, null, 2)}`;
}
