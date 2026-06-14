import type { AgentState, ChatMessage, StreamBlock, ToolStreamBlock } from "@/lib/store/agentStore";

export function selectChatMessages(state: AgentState): ChatMessage[] {
  return state.messages;
}

export function selectHasActiveAssistantStream(state: AgentState): boolean {
  return state.messages.some((message) => message.role === "assistant" && message.status === "streaming");
}

export function selectMessageText(message: ChatMessage): string {
  if (message.content) {
    return message.content;
  }

  return (message.blocks ?? [])
    .filter((block) => block.type === "text")
    .map(selectBlockText)
    .join("");
}

export function selectBlockText(block: Extract<StreamBlock, { type: "text" }>): string {
  return block.text;
}

export function selectToolBlockByCallId(messages: ChatMessage[], callId: string): ToolStreamBlock | null {
  for (const message of messages) {
    for (const block of message.blocks ?? []) {
      if (block.type === "tool" && block.callId === callId) {
        return block;
      }
    }
  }

  return null;
}
