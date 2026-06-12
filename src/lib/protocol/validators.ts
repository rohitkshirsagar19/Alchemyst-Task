import type {
  ClientMessage,
  ClientMessageType,
  ContextSnapshotMessage,
  ErrorMessage,
  JsonObject,
  JsonParseResult,
  JsonValue,
  PingMessage,
  ServerMessage,
  ServerMessageType,
  StreamEndMessage,
  TokenMessage,
  ToolAckMessage,
  ToolCallMessage,
  ToolResultMessage,
  UserMessage,
  PongMessage,
  ResumeMessage,
  ValidationResult,
} from "@/lib/protocol/types";
import { assertNever } from "@/lib/protocol/exhaustive";

const SERVER_MESSAGE_TYPES: ReadonlySet<ServerMessageType> = new Set([
  "TOKEN",
  "TOOL_CALL",
  "TOOL_RESULT",
  "CONTEXT_SNAPSHOT",
  "PING",
  "STREAM_END",
  "ERROR",
]);

const CLIENT_MESSAGE_TYPES: ReadonlySet<ClientMessageType> = new Set([
  "USER_MESSAGE",
  "PONG",
  "RESUME",
  "TOOL_ACK",
]);

export function safeJsonParse(raw: string): JsonParseResult {
  try {
    return {
      ok: true,
      value: JSON.parse(raw) as JsonValue,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown JSON parse error",
    };
  }
}

export function parseServerMessage(raw: string): ValidationResult<ServerMessage> {
  const parsed = safeJsonParse(raw);
  if (!parsed.ok) {
    return parsed;
  }

  return validateServerMessage(parsed.value);
}

export function validateServerMessage(value: JsonValue): ValidationResult<ServerMessage> {
  if (!isJsonObject(value)) {
    return invalid("Server message must be a JSON object");
  }

  const messageType = value.type;
  if (!isKnownServerMessageType(messageType)) {
    return invalid(`Unknown server message type: ${String(messageType)}`);
  }

  switch (messageType) {
    case "TOKEN":
      return validateTokenMessage(value);
    case "TOOL_CALL":
      return validateToolCallMessage(value);
    case "TOOL_RESULT":
      return validateToolResultMessage(value);
    case "CONTEXT_SNAPSHOT":
      return validateContextSnapshotMessage(value);
    case "PING":
      return validatePingMessage(value);
    case "STREAM_END":
      return validateStreamEndMessage(value);
    case "ERROR":
      return validateErrorMessage(value);
    default:
      return assertNever(messageType, "validateServerMessage");
  }
}

export function validateClientMessage(value: JsonValue): ValidationResult<ClientMessage> {
  if (!isJsonObject(value)) {
    return invalid("Client message must be a JSON object");
  }

  const messageType = value.type;
  if (!isKnownClientMessageType(messageType)) {
    return invalid(`Unknown client message type: ${String(messageType)}`);
  }

  switch (messageType) {
    case "USER_MESSAGE":
      return validateUserMessage(value);
    case "PONG":
      return validatePongMessage(value);
    case "RESUME":
      return validateResumeMessage(value);
    case "TOOL_ACK":
      return validateToolAckMessage(value);
    default:
      return assertNever(messageType, "validateClientMessage");
  }
}

function validateTokenMessage(value: JsonObject): ValidationResult<TokenMessage> {
  const seq = getRequiredNumber(value, "seq");
  const text = getRequiredString(value, "text");
  const streamId = getRequiredString(value, "stream_id");

  if (!seq.ok) return seq;
  if (!text.ok) return text;
  if (!streamId.ok) return streamId;

  return valid({
    type: "TOKEN",
    seq: seq.value,
    text: text.value,
    stream_id: streamId.value,
  });
}

function validateToolCallMessage(value: JsonObject): ValidationResult<ToolCallMessage> {
  const seq = getRequiredNumber(value, "seq");
  const callId = getRequiredString(value, "call_id");
  const toolName = getRequiredString(value, "tool_name");
  const args = getRequiredObject(value, "args");
  const streamId = getRequiredString(value, "stream_id");

  if (!seq.ok) return seq;
  if (!callId.ok) return callId;
  if (!toolName.ok) return toolName;
  if (!args.ok) return args;
  if (!streamId.ok) return streamId;

  return valid({
    type: "TOOL_CALL",
    seq: seq.value,
    call_id: callId.value,
    tool_name: toolName.value,
    args: args.value,
    stream_id: streamId.value,
  });
}

function validateToolResultMessage(value: JsonObject): ValidationResult<ToolResultMessage> {
  const seq = getRequiredNumber(value, "seq");
  const callId = getRequiredString(value, "call_id");
  const result = getRequiredObject(value, "result");
  const streamId = getRequiredString(value, "stream_id");

  if (!seq.ok) return seq;
  if (!callId.ok) return callId;
  if (!result.ok) return result;
  if (!streamId.ok) return streamId;

  return valid({
    type: "TOOL_RESULT",
    seq: seq.value,
    call_id: callId.value,
    result: result.value,
    stream_id: streamId.value,
  });
}

function validateContextSnapshotMessage(value: JsonObject): ValidationResult<ContextSnapshotMessage> {
  const seq = getRequiredNumber(value, "seq");
  const contextId = getRequiredString(value, "context_id");
  const data = getRequiredObject(value, "data");

  if (!seq.ok) return seq;
  if (!contextId.ok) return contextId;
  if (!data.ok) return data;

  return valid({
    type: "CONTEXT_SNAPSHOT",
    seq: seq.value,
    context_id: contextId.value,
    data: data.value,
  });
}

function validatePingMessage(value: JsonObject): ValidationResult<PingMessage> {
  const seq = getRequiredNumber(value, "seq");
  const challenge = getRequiredString(value, "challenge");

  if (!seq.ok) return seq;
  if (!challenge.ok) return challenge;

  return valid({
    type: "PING",
    seq: seq.value,
    challenge: challenge.value,
  });
}

function validateStreamEndMessage(value: JsonObject): ValidationResult<StreamEndMessage> {
  const seq = getRequiredNumber(value, "seq");
  const streamId = getRequiredString(value, "stream_id");

  if (!seq.ok) return seq;
  if (!streamId.ok) return streamId;

  return valid({
    type: "STREAM_END",
    seq: seq.value,
    stream_id: streamId.value,
  });
}

function validateErrorMessage(value: JsonObject): ValidationResult<ErrorMessage> {
  const seq = getRequiredNumber(value, "seq");
  const code = getRequiredString(value, "code");
  const message = getRequiredString(value, "message");

  if (!seq.ok) return seq;
  if (!code.ok) return code;
  if (!message.ok) return message;

  return valid({
    type: "ERROR",
    seq: seq.value,
    code: code.value,
    message: message.value,
  });
}

function validateUserMessage(value: JsonObject): ValidationResult<UserMessage> {
  const content = getRequiredString(value, "content");
  if (!content.ok) return content;

  return valid({
    type: "USER_MESSAGE",
    content: content.value,
  });
}

function validatePongMessage(value: JsonObject): ValidationResult<PongMessage> {
  const echo = getRequiredString(value, "echo");
  if (!echo.ok) return echo;

  return valid({
    type: "PONG",
    echo: echo.value,
  });
}

function validateResumeMessage(value: JsonObject): ValidationResult<ResumeMessage> {
  const lastSeq = getRequiredNumber(value, "last_seq");
  if (!lastSeq.ok) return lastSeq;

  return valid({
    type: "RESUME",
    last_seq: lastSeq.value,
  });
}

function validateToolAckMessage(value: JsonObject): ValidationResult<ToolAckMessage> {
  const callId = getRequiredString(value, "call_id");
  if (!callId.ok) return callId;

  return valid({
    type: "TOOL_ACK",
    call_id: callId.value,
  });
}

function getRequiredString(source: JsonObject, key: string): ValidationResult<string> {
  const value = source[key];
  return typeof value === "string"
    ? valid(value)
    : invalid(`Expected "${key}" to be a string`);
}

function getRequiredNumber(source: JsonObject, key: string): ValidationResult<number> {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value)
    ? valid(value)
    : invalid(`Expected "${key}" to be a finite number`);
}

function getRequiredObject(source: JsonObject, key: string): ValidationResult<JsonObject> {
  const value = source[key];
  return isJsonObject(value)
    ? valid(value)
    : invalid(`Expected "${key}" to be an object`);
}

function isJsonObject(value: JsonValue | unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownServerMessageType(value: JsonValue | undefined): value is ServerMessageType {
  return typeof value === "string" && SERVER_MESSAGE_TYPES.has(value as ServerMessageType);
}

function isKnownClientMessageType(value: JsonValue | undefined): value is ClientMessageType {
  return typeof value === "string" && CLIENT_MESSAGE_TYPES.has(value as ClientMessageType);
}

function valid<T>(value: T): ValidationResult<T> {
  return {
    ok: true,
    value,
  };
}

function invalid(reason: string): ValidationResult<never> {
  return {
    ok: false,
    reason,
  };
}
