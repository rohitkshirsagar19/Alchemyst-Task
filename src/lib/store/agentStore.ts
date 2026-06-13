import type { JsonValue, ServerMessage } from "@/lib/protocol/types";

export interface TextStreamBlock {
  type: "text";
  id: string;
  text: string;
  seqStart: number;
  seqEnd: number;
}

export interface ToolStreamBlock {
  type: "tool";
  id: string;
  callId: string;
  toolName: string;
  args: JsonValue;
  result?: JsonValue;
  status: "waiting" | "completed" | "error";
  streamId: string;
  callSeq: number;
  resultSeq?: number;
}

export type StreamBlock = TextStreamBlock | ToolStreamBlock;

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
    case "TOOL_CALL":
      return appendToolCall(state, message);
    case "TOOL_RESULT":
      return applyToolResult(state, message);
    case "STREAM_END":
      return markStreamEnded(state, message.stream_id);
    case "ERROR":
      return markLatestAssistantError(state);
    case "CONTEXT_SNAPSHOT":
    case "PING":
      return state;
    default:
      return state;
  }
}

function appendToken(state: AgentState, message: Extract<ServerMessage, { type: "TOKEN" }>): AgentState {
  const { existingIndex, existingMessage } = ensureAssistantMessageForStream(state, message.stream_id);

  if (!existingMessage) {
    const block: TextStreamBlock = {
      type: "text",
      id: textBlockId(message.stream_id, message.seq),
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

  const blocks = existingMessage.blocks ?? [];
  const lastBlock = blocks.at(-1);
  const nextBlocks: StreamBlock[] = lastBlock?.type === "text"
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
          id: textBlockId(message.stream_id, message.seq),
          text: message.text,
          seqStart: message.seq,
          seqEnd: message.seq,
        },
      ];

  const nextMessage: ChatMessage = {
    ...existingMessage,
    status: existingMessage.status === "ended" ? "ended" : "streaming",
    content: (existingMessage.content ?? "") + message.text,
    blocks: nextBlocks,
  };

  return {
    ...state,
    messages: replaceMessage(state.messages, existingIndex, nextMessage),
  };
}

function appendToolCall(state: AgentState, message: Extract<ServerMessage, { type: "TOOL_CALL" }>): AgentState {
  const { existingIndex, existingMessage } = ensureAssistantMessageForStream(state, message.stream_id);
  const baseMessage = existingMessage ?? {
    id: message.stream_id,
    role: "assistant" as const,
    streamId: message.stream_id,
    status: "streaming" as const,
    content: "",
    blocks: [],
  };

  const blocks = baseMessage.blocks ?? [];
  if (blocks.some((block) => block.type === "tool" && block.callId === message.call_id)) {
    return state;
  }

  const toolBlock: ToolStreamBlock = {
    type: "tool",
    id: `${message.stream_id}:tool:${message.call_id}`,
    callId: message.call_id,
    toolName: message.tool_name,
    args: message.args,
    status: "waiting",
    streamId: message.stream_id,
    callSeq: message.seq,
  };

  const nextMessage: ChatMessage = {
    ...baseMessage,
    status: baseMessage.status === "ended" ? "ended" : "streaming",
    blocks: [...blocks, toolBlock],
  };

  if (!existingMessage) {
    return {
      ...state,
      messages: [...state.messages, nextMessage],
    };
  }

  return {
    ...state,
    messages: replaceMessage(state.messages, existingIndex, nextMessage),
  };
}

function applyToolResult(state: AgentState, message: Extract<ServerMessage, { type: "TOOL_RESULT" }>): AgentState {
  const match = findToolBlock(state.messages, message.call_id);
  if (!match) {
    return state;
  }

  const targetMessage = state.messages[match.messageIndex];
  const targetBlocks = targetMessage.blocks ?? [];
  const targetBlock = targetBlocks[match.blockIndex];

  if (!targetBlock || targetBlock.type !== "tool") {
    return state;
  }

  const nextBlocks = replaceBlock(targetBlocks, match.blockIndex, {
    ...targetBlock,
    result: message.result,
    resultSeq: message.seq,
    status: "completed",
  });

  return {
    ...state,
    messages: replaceMessage(state.messages, match.messageIndex, {
      ...targetMessage,
      blocks: nextBlocks,
    }),
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

function ensureAssistantMessageForStream(state: AgentState, streamId: string): {
  existingIndex: number;
  existingMessage: ChatMessage | null;
} {
  const existingIndex = state.messages.findIndex(
    (entry) => entry.role === "assistant" && entry.streamId === streamId,
  );

  return {
    existingIndex,
    existingMessage: existingIndex === -1 ? null : state.messages[existingIndex],
  };
}

function textBlockId(streamId: string, seqStart: number): string {
  return streamId + ":text:" + String(seqStart);
}

function findToolBlock(messages: ChatMessage[], callId: string): { messageIndex: number; blockIndex: number } | null {
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const blocks = messages[messageIndex].blocks ?? [];
    const blockIndex = blocks.findIndex((block) => block.type === "tool" && block.callId === callId);
    if (blockIndex !== -1) {
      return { messageIndex, blockIndex };
    }
  }

  return null;
}

function replaceBlock(blocks: StreamBlock[], index: number, nextBlock: StreamBlock): StreamBlock[] {
  return [
    ...blocks.slice(0, index),
    nextBlock,
    ...blocks.slice(index + 1),
  ];
}

function replaceMessage(messages: ChatMessage[], index: number, nextMessage: ChatMessage): ChatMessage[] {
  return [
    ...messages.slice(0, index),
    nextMessage,
    ...messages.slice(index + 1),
  ];
}
