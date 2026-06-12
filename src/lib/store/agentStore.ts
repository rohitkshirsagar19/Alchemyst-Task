import type { ServerMessage } from "@/lib/protocol/types";

export interface TextStreamBlock {
  type: "text";
  id: string;
  text: string;
  seqStart: number;
  seqEnd: number;
}

export type StreamBlock = TextStreamBlock;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  streamId?: string;
  status?: "streaming" | "ended" | "error";
  blocks?: StreamBlock[];
}

export interface AgentState {
  messages: ChatMessage[];
}

export type AgentAction =
  | {
      type: "ADD_USER_MESSAGE";
      message: ChatMessage;
    }
  | {
      type: "APPLY_PROCESSED_MESSAGES";
      messages: ServerMessage[];
    };

export const initialAgentState: AgentState = {
  messages: [],
};

export function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.message],
      };
    case "APPLY_PROCESSED_MESSAGES":
      return action.messages.reduce(applyServerMessage, state);
    default:
      return state;
  }
}

function applyServerMessage(state: AgentState, message: ServerMessage): AgentState {
  switch (message.type) {
    case "TOKEN":
      return appendToken(state, message);
    case "STREAM_END":
      return markStreamEnded(state, message.stream_id);
    case "ERROR":
      return markLatestAssistantError(state);
    case "TOOL_CALL":
    case "TOOL_RESULT":
    case "CONTEXT_SNAPSHOT":
    case "PING":
      return state;
    default:
      return state;
  }
}

function appendToken(state: AgentState, message: Extract<ServerMessage, { type: "TOKEN" }>): AgentState {
  const existingIndex = state.messages.findIndex(
    (entry) => entry.role === "assistant" && entry.streamId === message.stream_id,
  );

  if (existingIndex === -1) {
    const block: TextStreamBlock = {
      type: "text",
      id: `${message.stream_id}:text:1`,
      text: message.text,
      seqStart: message.seq,
      seqEnd: message.seq,
    };

    const nextMessage: ChatMessage = {
      id: message.stream_id,
      role: "assistant",
      streamId: message.stream_id,
      status: "streaming",
      content: message.text,
      blocks: [block],
    };

    return {
      ...state,
      messages: [...state.messages, nextMessage],
    };
  }

  const existing = state.messages[existingIndex];
  const blocks = existing.blocks ?? [];
  const lastBlock = blocks.at(-1);
  const nextBlocks: TextStreamBlock[] = lastBlock
    ? [
        ...blocks.slice(0, -1),
        {
          ...lastBlock,
          text: lastBlock.text + message.text,
          seqEnd: message.seq,
        },
      ]
    : [
        ...blocks,
        {
          type: "text",
          id: `${message.stream_id}:text:${blocks.length + 1}`,
          text: message.text,
          seqStart: message.seq,
          seqEnd: message.seq,
        },
      ];

  const nextMessage: ChatMessage = {
    ...existing,
    status: existing.status === "ended" ? "ended" : "streaming",
    content: (existing.content ?? "") + message.text,
    blocks: nextBlocks,
  };

  return {
    ...state,
    messages: replaceMessage(state.messages, existingIndex, nextMessage),
  };
}

function markStreamEnded(state: AgentState, streamId: string): AgentState {
  const existingIndex = state.messages.findIndex(
    (entry) => entry.role === "assistant" && entry.streamId === streamId,
  );

  if (existingIndex === -1) {
    return state;
  }

  const nextMessage: ChatMessage = {
    ...state.messages[existingIndex],
    status: "ended",
  };

  return {
    ...state,
    messages: replaceMessage(state.messages, existingIndex, nextMessage),
  };
}

function markLatestAssistantError(state: AgentState): AgentState {
  const existingIndex = [...state.messages]
    .reverse()
    .findIndex((entry) => entry.role === "assistant");

  if (existingIndex === -1) {
    return state;
  }

  const actualIndex = state.messages.length - 1 - existingIndex;
  const nextMessage: ChatMessage = {
    ...state.messages[actualIndex],
    status: "error",
  };

  return {
    ...state,
    messages: replaceMessage(state.messages, actualIndex, nextMessage),
  };
}

function replaceMessage(messages: ChatMessage[], index: number, nextMessage: ChatMessage): ChatMessage[] {
  return [
    ...messages.slice(0, index),
    nextMessage,
    ...messages.slice(index + 1),
  ];
}
