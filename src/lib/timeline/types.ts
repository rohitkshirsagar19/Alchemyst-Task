import type { JsonValue } from "@/lib/protocol/types";

export type TimelineEventDirection = "inbound" | "outbound" | "internal";

export type TimelineEventKind =
  | "USER_MESSAGE"
  | "TOKEN"
  | "TOKEN_GROUP"
  | "TOOL_CALL"
  | "TOOL_ACK"
  | "TOOL_RESULT"
  | "CONTEXT_SNAPSHOT"
  | "PING"
  | "PONG"
  | "STREAM_END"
  | "ERROR"
  | "CONNECTION"
  | "INVALID_MESSAGE"
  | "BUFFERED"
  | "DUPLICATE_IGNORED"
  | "TOOL_ACK_SKIPPED";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  direction: TimelineEventDirection;
  timestamp: number;
  seq?: number;
  seqStart?: number;
  seqEnd?: number;
  streamId?: string;
  callId?: string;
  contextId?: string;
  title: string;
  summary: string;
  payloadPreview: string;
  payload?: JsonValue;
  relatedChatElementId?: string;
}

export interface TokenGroupTimelineEvent extends TimelineEvent {
  kind: "TOKEN_GROUP";
  direction: "inbound";
  seqStart: number;
  seqEnd: number;
  streamId: string;
  tokenCount: number;
  text: string;
}

export type TimelineRowEvent = TimelineEvent | TokenGroupTimelineEvent;
