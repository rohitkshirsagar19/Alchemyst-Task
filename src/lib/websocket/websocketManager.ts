import { buildPong, serializeClientMessage } from "@/lib/protocol/clientMessages";
import type { ClientMessage, ServerMessage, ValidationResult } from "@/lib/protocol/types";
import { parseServerMessage } from "@/lib/protocol/validators";

export type WebSocketConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
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

export interface OutboundSocketMessageEvent {
  message: ClientMessage;
  source: "manual" | "heartbeat";
}

export interface WebSocketManagerOptions {
  url: string;
  onStatusChange?: (status: WebSocketConnectionStatus) => void;
  onOpen?: () => void;
  onMessage?: (event: ParsedSocketMessageEvent) => void;
  onSend?: (event: OutboundSocketMessageEvent) => void;
  onInvalidMessage?: (event: InvalidSocketMessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private status: WebSocketConnectionStatus = "idle";
  private readonly options: WebSocketManagerOptions;

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

    this.setStatus("connecting");
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }
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
      this.setStatus("closed");
      this.options.onClose?.(event);
    };

    socket.onerror = (event) => {
      this.setStatus("error");
      this.options.onError?.(event);
    };
  }

  disconnect(): void {
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
    return this.sendInternal(message, "manual");
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

    this.options.onMessage?.({
      raw: rawResult.value,
      message: parsed.value,
    });
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
