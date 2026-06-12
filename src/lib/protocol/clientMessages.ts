import type {
  ClientMessage,
  PongMessage,
  ResumeMessage,
  ToolAckMessage,
  UserMessage,
} from "@/lib/protocol/types";

export function buildUserMessage(content: string): UserMessage {
  return {
    type: "USER_MESSAGE",
    content,
  };
}

export function buildPong(echo: string): PongMessage {
  return {
    type: "PONG",
    echo,
  };
}

export function buildResume(lastSeq: number): ResumeMessage {
  return {
    type: "RESUME",
    last_seq: lastSeq,
  };
}

export function buildToolAck(callId: string): ToolAckMessage {
  return {
    type: "TOOL_ACK",
    call_id: callId,
  };
}

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
