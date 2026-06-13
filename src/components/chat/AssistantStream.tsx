import { memo } from "react";
import type { ChatMessage } from "@/lib/store/agentStore";
import { selectBlockText } from "@/lib/store/selectors";
import { ToolCallCard } from "@/components/chat/ToolCallCard";

type AssistantStreamProps = {
  message: ChatMessage;
  selectedCallId: string | null;
  selectedChatElementId: string | null;
  onSelectCallId: (callId: string) => void;
};

function AssistantStreamComponent({ message, selectedCallId, selectedChatElementId, onSelectCallId }: AssistantStreamProps) {
  return (
    <article className="chat-bubble chat-bubble--assistant">
      <div className="chat-bubble__meta">
        <span>Assistant</span>
        <span className={`status-badge status-badge--${message.status ?? "streaming"}`}>
          {message.status ?? "streaming"}
        </span>
      </div>
      <div className="assistant-blocks">
        {(message.blocks ?? []).map((block) => (
          block.type === "text" ? (
            <p
              className={`chat-bubble__text${block.id === selectedChatElementId ? " chat-bubble__text--selected" : ""}`}
              id={block.id}
              key={block.id}
            >
              {selectBlockText(block)}
            </p>
          ) : (
            <ToolCallCard
              block={block}
              isSelected={block.callId === selectedCallId || block.id === selectedChatElementId}
              key={block.id}
              onSelect={onSelectCallId}
            />
          )
        ))}
      </div>
    </article>
  );
}

export const AssistantStream = memo(AssistantStreamComponent);
