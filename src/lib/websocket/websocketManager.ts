import { buildPong, buildResume, buildToolAck, serializeClientMessage } from "@/lib/protocol/clientMessages";
import type { ClientMessage, ServerMessage, ValidationResult } from "@/lib/protocol/types";
import { parseServerMessage } from "@/lib/protocol/validators";
import { createReconnectBackoff } from "@/lib/websocket/reconnectBackoff";

export type WebSocketConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "resuming"
  | "closing"
  | "closed"
  | "error";

export interface ParsedSocketMessageEvent {
  raw: string;
  message: ServerMessage;
}

export interface InvalidSocketMessageEvent {
  raw: string | null;
  reason: string;
}

export interface SuppressedToolAckEvent {
  callId: string;
}

export interface QueuedToolAckEvent {
  callId: string;
  reason: string;
}

export interface OutboundSocketMessageEvent {
  message: ClientMessage;
  source: "manual" | "heartbeat" | "tool_ack" | "resume";
}

export interface ReconnectScheduledEvent {
  attempt: number;
  delayMs: number;
}

export interface ReconnectAttemptEvent {
  attempt: number;
}

export interface ResumeEvent {
  lastSeq: number;
}

export interface WebSocketManagerOptions {
  url: string;
  getResumeSeq?: () => number;
  onStatusChange?: (status: WebSocketConnectionStatus) => void;
  onOpen?: () => void;
  onMessage?: (event: ParsedSocketMessageEvent) => void;
  onSend?: (event: OutboundSocketMessageEvent) => void;
  onToolAckSuppressed?: (event: SuppressedToolAckEvent) => void;
  onToolAckQueued?: (event: QueuedToolAckEvent) => void;
  onReconnectScheduled?: (event: ReconnectScheduledEvent) => void;
  onReconnectAttempt?: (event: ReconnectAttemptEvent) => void;
  onResume?: (event: ResumeEvent) => void;
  onInvalidMessage?: (event: InvalidSocketMessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private status: WebSocketConnectionStatus = "idle";
  private readonly acknowledgedToolCalls = new Set<string>();
  private readonly pendingToolAcks = new Set<string>();
  private readonly reconnectBackoff = createReconnectBackoff({
    initialMs: 500,
    factor: 2,
    maxMs: 10000,
  });
  private readonly options: WebSocketManagerOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private shouldResumeOnOpen = false;

  constructor(options: WebSocketManagerOptions) {
    this.options = options;
  }

  getStatus(): WebSocketConnectionStatus {
    return this.status;
  }

  connect(): void {
    if (this.socket && (this.status === "connecting" || this.status === "open")) {
      return;
    }

    this.intentionalDisconnect = false;
    this.shouldResumeOnOpen = false;
    this.clearReconnectTimer();
    this.setStatus("connecting");
    this.openSocket();
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.shouldResumeOnOpen = false;
    this.clearReconnectTimer();

    if (!this.socket) {
      if (this.status !== "idle") {
        this.setStatus("closed");
      }
      return;
    }

    this.setStatus("closing");
    this.socket.close(1000, "manual_disconnect");
  }

  send(message: ClientMessage): ValidationResult<void> {
    if (this.status === "reconnecting" || this.status === "resuming") {
      return {
        ok: false,
        reason: "WebSocket is reconnecting",
      };
    }

    return this.sendInternal(message, "manual");
  }

  private openSocket(): void {
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectBackoff.reset();
      this.clearReconnectTimer();

      if (this.shouldResumeOnOpen) {
        const lastSeq = this.options.getResumeSeq?.() ?? 0;
        this.setStatus("resuming");
        this.options.onResume?.({ lastSeq });
        this.sendInternal(buildResume(lastSeq), "resume");
        this.flushPendingToolAcks();
        this.shouldResumeOnOpen = false;
        this.setStatus("open");
        this.options.onOpen?.();
        return;
      }

      this.flushPendingToolAcks();
      this.setStatus("open");
      this.options.onOpen?.();
    };

    socket.onmessage = (event) => {
      void this.handleMessage(event);
    };

    socket.onclose = (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.options.onClose?.(event);

      if (this.intentionalDisconnect || this.status === "closing") {
        this.setStatus("closed");
        return;
      }

      this.scheduleReconnect();
    };

    socket.onerror = (event) => {
      this.options.onError?.(event);
      if (this.intentionalDisconnect || this.status === "closing") {
        this.setStatus("error");
        return;
      }

      this.scheduleReconnect();
    };
  }

  private sendInternal(message: ClientMessage, source: OutboundSocketMessageEvent["source"]): ValidationResult<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        reason: "WebSocket is not connected",
      };
    }

    this.socket.send(serializeClientMessage(message));
    this.options.onSend?.({
      message,
      source,
    });

    return {
      ok: true,
      value: undefined,
    };
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    const rawResult = await toRawMessage(event.data);
    if (!rawResult.ok) {
      this.options.onInvalidMessage?.({
        raw: null,
        reason: rawResult.reason,
      });
      return;
    }

    const parsed = parseServerMessage(rawResult.value);
    if (!parsed.ok) {
      this.options.onInvalidMessage?.({
        raw: rawResult.value,
        reason: parsed.reason,
      });
      return;
    }

    if (parsed.value.type === "PING") {
      this.sendInternal(buildPong(parsed.value.challenge), "heartbeat");
    }

    if (parsed.value.type === "TOOL_CALL") {
      this.acknowledgeToolCall(parsed.value.call_id);
    }

    this.options.onMessage?.({
      raw: rawResult.value,
      message: parsed.value,
    });
  }

  private acknowledgeToolCall(callId: string): void {
    if (this.acknowledgedToolCalls.has(callId)) {
      this.options.onToolAckSuppressed?.({ callId });
      return;
    }

    const result = this.sendInternal(buildToolAck(callId), "tool_ack");
    if (result.ok) {
      this.pendingToolAcks.delete(callId);
      this.acknowledgedToolCalls.add(callId);
      return;
    }

    // Chaos mode can drop the socket right as TOOL_CALL arrives. Queue the ACK so
    // it can be flushed immediately after RESUME on the next connection instead of
    // waiting for the replayed TOOL_CALL to reach the raw message path again.
    this.pendingToolAcks.add(callId);
    this.options.onToolAckQueued?.({
      callId,
      reason: result.reason,
    });
  }

  private flushPendingToolAcks(): void {
    if (this.pendingToolAcks.size === 0) {
      return;
    }

    for (const callId of [...this.pendingToolAcks]) {
      if (this.acknowledgedToolCalls.has(callId)) {
        this.pendingToolAcks.delete(callId);
        continue;
      }

      const result = this.sendInternal(buildToolAck(callId), "tool_ack");
      if (!result.ok) {
        return;
      }

      this.pendingToolAcks.delete(callId);
      this.acknowledgedToolCalls.add(callId);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.intentionalDisconnect) {
      return;
    }

    const delayMs = this.reconnectBackoff.nextDelay();
    const attempt = this.reconnectBackoff.getAttempt();
    this.shouldResumeOnOpen = true;
    this.setStatus("reconnecting");
    this.options.onReconnectScheduled?.({ attempt, delayMs });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalDisconnect) {
        return;
      }

      this.options.onReconnectAttempt?.({ attempt });
      this.openSocket();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(status: WebSocketConnectionStatus): void {
    this.status = status;
    this.options.onStatusChange?.(status);
  }
}

async function toRawMessage(data: unknown): Promise<ValidationResult<string>> {
  if (typeof data === "string") {
    return {
      ok: true,
      value: data,
    };
  }

  if (data instanceof Blob) {
    return {
      ok: true,
      value: await data.text(),
    };
  }

  if (data instanceof ArrayBuffer) {
    return {
      ok: true,
      value: new TextDecoder().decode(data),
    };
  }

  if (ArrayBuffer.isView(data)) {
    return {
      ok: true,
      value: new TextDecoder().decode(data),
    };
  }

  return {
    ok: false,
    reason: `Unsupported WebSocket message payload: ${Object.prototype.toString.call(data)}`,
  };
}
