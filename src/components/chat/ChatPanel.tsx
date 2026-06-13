"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AssistantStream } from "@/components/chat/AssistantStream";
import { MessageInput } from "@/components/chat/MessageInput";
import { Panel } from "@/components/layout/Panel";
import { AGENT_WS_URL } from "@/lib/config/env";
import { buildUserMessage } from "@/lib/protocol/clientMessages";
import { createOrderingBuffer, type OrderedPushResult } from "@/lib/protocol/orderingBuffer";
import type { ClientMessage, JsonObject, JsonValue, ServerMessage } from "@/lib/protocol/types";
import { agentReducer, initialAgentState, type AgentAction, type AgentState, type ChatMessage } from "@/lib/store/agentStore";
import { selectChatMessages, selectToolBlockByCallId } from "@/lib/store/selectors";
import type { TimelineEvent, TimelineEventDirection, TimelineEventKind } from "@/lib/timeline/types";
import {
  WebSocketManager,
  type InvalidSocketMessageEvent,
  type OutboundSocketMessageEvent,
  type ParsedSocketMessageEvent,
  type WebSocketConnectionStatus,
} from "@/lib/websocket/websocketManager";

type ChatPanelProps = {
  selectedCallId: string | null;
  selectedChatElementId: string | null;
  onSelectCallId: (callId: string | null) => void;
  onTimelineEvent: (event: TimelineEvent) => void;
};

export function ChatPanel({ selectedCallId, selectedChatElementId, onSelectCallId, onTimelineEvent }: ChatPanelProps) {
  const [status, setStatus] = useState<WebSocketConnectionStatus>("idle");
  const [draft, setDraft] = useState("hello");
  const [state, setState] = useState<AgentState>(initialAgentState);
  const managerRef = useRef<WebSocketManager | null>(null);
  const nextTimelineIdRef = useRef(1);
  const userMessageCountRef = useRef(1);
  const orderingBufferRef = useRef(createOrderingBuffer({ initialExpectedSeq: 1 }));
  const stateRef = useRef<AgentState>(initialAgentState);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const manager = new WebSocketManager({
      url: AGENT_WS_URL,
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus);
      },
      onOpen: () => {
        orderingBufferRef.current.reset({ initialExpectedSeq: 1 });
        recordInternalEvent("CONNECTION", "WebSocket connected", `Connected to ${AGENT_WS_URL}`, { status: "open", url: AGENT_WS_URL });
        recordInternalEvent("CONNECTION", "Ordering reset", "Ordering buffer reset for a new connection. Expected seq = 1.", { expectedSeq: 1 });
      },
      onMessage: (event) => {
        recordInboundEvent(event);
        const result = orderingBufferRef.current.push(event.message);
        recordOrderingOutcome(result);
        if (result.processed.length > 0) {
          const nextState = applyAction({
            type: "APPLY_PROCESSED_MESSAGES",
            messages: result.processed,
          });
          handleProcessedSideEffects(result.processed, nextState);
        }
      },
      onSend: (event) => {
        recordOutboundEvent(event);
      },
      onToolAckSuppressed: (event) => {
        recordInternalEvent("TOOL_ACK_SKIPPED", "Duplicate TOOL_ACK suppressed", `Skipped duplicate fast ACK for ${event.callId}.`, { callId: event.callId }, { callId: event.callId });
      },
      onInvalidMessage: (event) => {
        recordInvalidEvent(event);
      },
      onClose: (event) => {
        const summary = event.reason ? `Connection closed (${event.code}): ${event.reason}` : `Connection closed (${event.code})`;
        recordInternalEvent("CONNECTION", "WebSocket closed", summary, { code: event.code, reason: event.reason });
      },
      onError: () => {
        recordInternalEvent("CONNECTION", "WebSocket error", "WebSocket reported an error event.", { status: "error" });
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

  function applyAction(action: AgentAction): AgentState {
    const nextState = agentReducer(stateRef.current, action);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }

  function handleProcessedSideEffects(processedMessages: ServerMessage[], nextState: AgentState): void {
    for (const message of processedMessages) {
      if (message.type === "TOOL_RESULT" && !selectToolBlockByCallId(nextState.messages, message.call_id)) {
        recordInternalEvent(
          "ERROR",
          "Missing tool card",
          `No matching tool block found for result ${message.call_id}.`,
          { callId: message.call_id },
          { callId: message.call_id },
        );
      }
    }
  }

  function recordTimelineEvent(event: Omit<TimelineEvent, "id" | "timestamp" | "payloadPreview"> & { payloadPreview?: string }): void {
    onTimelineEvent({
      ...event,
      id: `trace-${nextTimelineIdRef.current++}`,
      timestamp: Date.now(),
      payloadPreview: event.payloadPreview ?? previewPayload(event.payload),
    });
  }

  function recordInboundEvent(event: ParsedSocketMessageEvent): void {
    const message = event.message;
    recordTimelineEvent({
      kind: message.type,
      direction: "inbound",
      title: message.type,
      summary: summarizeServerMessage(message),
      payload: serverMessagePayload(message),
      payloadPreview: message.type === "CONTEXT_SNAPSHOT" ? summarizeContextPayload(message.data) : undefined,
      seq: message.seq,
      streamId: "stream_id" in message ? message.stream_id : undefined,
      callId: "call_id" in message ? message.call_id : undefined,
      contextId: "context_id" in message ? message.context_id : undefined,
      relatedChatElementId: relatedChatElementId(message),
    });
  }

  function recordOutboundEvent(event: OutboundSocketMessageEvent): void {
    const message = event.message;
    recordTimelineEvent({
      kind: message.type === "RESUME" ? "CONNECTION" : message.type,
      direction: "outbound",
      title: message.type,
      summary: summarizeClientMessage(message, event.source),
      payload: clientMessagePayload(message),
      callId: message.type === "TOOL_ACK" ? message.call_id : undefined,
      relatedChatElementId: undefined,
    });
  }

  function recordInvalidEvent(event: InvalidSocketMessageEvent): void {
    recordTimelineEvent({
      kind: "INVALID_MESSAGE",
      direction: "internal",
      title: "INVALID_MESSAGE",
      summary: event.reason,
      payload: event.raw ?? event.reason,
    });
  }

  function recordInternalEvent(
    kind: TimelineEventKind,
    title: string,
    summary: string,
    payload?: JsonValue,
    links?: { callId?: string; streamId?: string; relatedChatElementId?: string },
  ): void {
    recordTimelineEvent({
      kind,
      direction: "internal",
      title,
      summary,
      payload,
      callId: links?.callId,
      streamId: links?.streamId,
      relatedChatElementId: links?.relatedChatElementId,
    });
  }

  function recordOrderingOutcome(result: OrderedPushResult): void {
    if (result.accepted === "buffered") {
      recordTimelineEvent({
        kind: "BUFFERED",
        direction: "internal",
        title: "Buffered message",
        summary: `Buffered seq ${result.receivedSeq}; waiting for seq ${result.expectedSeq}.`,
        payload: { receivedSeq: result.receivedSeq, expectedSeq: result.expectedSeq, bufferedCount: result.bufferedCount },
        seq: result.receivedSeq,
      });
      return;
    }

    if (result.accepted === "duplicate") {
      recordTimelineEvent({
        kind: "DUPLICATE_IGNORED",
        direction: "internal",
        title: "Duplicate ignored",
        summary: `Ignored seq ${result.receivedSeq}; expected seq ${result.expectedSeq}.`,
        payload: { receivedSeq: result.receivedSeq, expectedSeq: result.expectedSeq, bufferedCount: result.bufferedCount },
        seq: result.receivedSeq,
      });
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
      recordInternalEvent("ERROR", "Send failed", "WebSocket manager is not ready.");
      return;
    }

    if (!result.ok) {
      recordInternalEvent("ERROR", "Send blocked", result.reason);
      return;
    }

    applyAction({
      type: "ADD_USER_MESSAGE",
      message: {
        id: `user-${userMessageCountRef.current++}`,
        role: "user",
        content,
        status: "ended",
      },
    });

    orderingBufferRef.current.reset({ initialExpectedSeq: 1 });
    recordInternalEvent("CONNECTION", "Ordering reset", "Ordering buffer reset for a new server turn. Expected seq = 1.", { expectedSeq: 1 });
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
                  <AssistantStream
                    key={message.id}
                    message={message}
                    onSelectCallId={onSelectCallId}
                    selectedCallId={selectedCallId}
                    selectedChatElementId={selectedChatElementId}
                  />
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

function summarizeServerMessage(message: ServerMessage): string {
  switch (message.type) {
    case "TOKEN":
      return message.text;
    case "TOOL_CALL":
      return `${message.tool_name} call_id=${message.call_id}`;
    case "TOOL_RESULT":
      return `Result for call_id=${message.call_id}`;
    case "CONTEXT_SNAPSHOT":
      return `${message.context_id} · ${summarizeContextPayload(message.data)}`;
    case "PING":
      return message.challenge === "" ? "Empty heartbeat challenge" : `challenge=${message.challenge}`;
    case "STREAM_END":
      return `stream ${message.stream_id} ended`;
    case "ERROR":
      return `${message.code}: ${message.message}`;
    default:
      return "Server event";
  }
}

function summarizeClientMessage(message: ClientMessage, source: string): string {
  switch (message.type) {
    case "USER_MESSAGE":
      return message.content;
    case "PONG":
      return message.echo === "" ? `PONG empty echo (${source})` : `PONG echo=${message.echo}`;
    case "TOOL_ACK":
      return `ACK call_id=${message.call_id}`;
    case "RESUME":
      return `Resume from seq ${message.last_seq}`;
    default:
      return "Client event";
  }
}

function relatedChatElementId(message: ServerMessage): string | undefined {
  switch (message.type) {
    case "TOKEN":
      return `${message.stream_id}:text:${message.seq}`;
    case "TOOL_CALL":
    case "TOOL_RESULT":
      return `${message.stream_id}:tool:${message.call_id}`;
    default:
      return undefined;
  }
}

function serverMessagePayload(message: ServerMessage): JsonValue {
  switch (message.type) {
    case "TOKEN":
      return message.text;
    case "TOOL_CALL":
      return { type: message.type, seq: message.seq, call_id: message.call_id, tool_name: message.tool_name, args: message.args, stream_id: message.stream_id };
    case "TOOL_RESULT":
      return { type: message.type, seq: message.seq, call_id: message.call_id, result: message.result, stream_id: message.stream_id };
    case "CONTEXT_SNAPSHOT":
      return { type: message.type, seq: message.seq, context_id: message.context_id, data: message.data };
    case "PING":
      return { type: message.type, seq: message.seq, challenge: message.challenge };
    case "STREAM_END":
      return { type: message.type, seq: message.seq, stream_id: message.stream_id };
    case "ERROR":
      return { type: message.type, seq: message.seq, code: message.code, message: message.message };
    default:
      return null;
  }
}

function clientMessagePayload(message: ClientMessage): JsonValue {
  switch (message.type) {
    case "USER_MESSAGE":
      return { type: message.type, content: message.content };
    case "PONG":
      return { type: message.type, echo: message.echo };
    case "RESUME":
      return { type: message.type, last_seq: message.last_seq };
    case "TOOL_ACK":
      return { type: message.type, call_id: message.call_id };
    default:
      return null;
  }
}

function previewPayload(payload: JsonValue | undefined): string {
  if (payload === undefined) {
    return "";
  }

  if (typeof payload === "string") {
    return payload.length > 600 ? `${payload.slice(0, 600)}...` : payload;
  }

  const serialized = JSON.stringify(payload, null, 2);
  return serialized.length > 1200 ? `${serialized.slice(0, 1200)}...` : serialized;
}

function summarizeContextPayload(data: JsonObject): string {
  const approxBytes = new Blob([JSON.stringify(data)]).size;
  if (approxBytes < 1024) {
    return `approx ${approxBytes}B`;
  }

  return `approx ${Math.round(approxBytes / 1024)}KB`;
}
