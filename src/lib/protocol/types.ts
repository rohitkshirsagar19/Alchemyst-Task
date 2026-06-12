export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type JsonObject = {
  [key: string]: JsonValue;
};

export type JsonArray = JsonValue[];

export type ServerMessageType =
  | "TOKEN"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "CONTEXT_SNAPSHOT"
  | "PING"
  | "STREAM_END"
  | "ERROR";

export type ClientMessageType = "USER_MESSAGE" | "PONG" | "RESUME" | "TOOL_ACK";

export interface TokenMessage {
  type: "TOKEN";
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  seq: number;
  call_id: string;
  tool_name: string;
  args: JsonObject;
  stream_id: string;
}

export interface ToolResultMessage {
  type: "TOOL_RESULT";
  seq: number;
  call_id: string;
  result: JsonObject;
  stream_id: string;
}

export interface ContextSnapshotMessage {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: JsonObject;
}

export interface PingMessage {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEndMessage {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;

export interface UserMessage {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongMessage {
  type: "PONG";
  echo: string;
}

export interface ResumeMessage {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckMessage {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage =
  | UserMessage
  | PongMessage
  | ResumeMessage
  | ToolAckMessage;

export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

export interface ValidationFailure {
  ok: false;
  reason: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface JsonParseSuccess {
  ok: true;
  value: JsonValue;
}

export interface JsonParseFailure {
  ok: false;
  reason: string;
}

export type JsonParseResult = JsonParseSuccess | JsonParseFailure;
