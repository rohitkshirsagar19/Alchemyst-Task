import type { AgentState, ChatMessage, StreamBlock } from "@/lib/store/agentStore";

export function selectChatMessages(state: AgentState): ChatMessage[] {
  return state.messages;
}

export function selectMessageText(message: ChatMessage): string {
  if (message.content) {
    return message.content;
  }

  return (message.blocks ?? []).map(selectBlockText).join("");
}

export function selectBlockText(block: StreamBlock): string {
  return block.text;
}
