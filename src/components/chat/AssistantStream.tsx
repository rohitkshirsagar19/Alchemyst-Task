import { memo } from "react";
import type { ChatMessage } from "@/lib/store/agentStore";
import { selectBlockText } from "@/lib/store/selectors";
import { ToolCallCard } from "@/components/chat/ToolCallCard";

type AssistantStreamProps = {
  message: ChatMessage;
};

function AssistantStreamComponent({ message }: AssistantStreamProps) {
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
            <p key={block.id} className="chat-bubble__text">{selectBlockText(block)}</p>
          ) : (
            <ToolCallCard key={block.id} block={block} />
          )
        ))}
      </div>
    </article>
  );
}

export const AssistantStream = memo(AssistantStreamComponent);
