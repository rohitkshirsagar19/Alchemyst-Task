import { memo } from "react";
import type { ChatMessage } from "@/lib/store/agentStore";
import { selectMessageText } from "@/lib/store/selectors";

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
      <p className="chat-bubble__text">{selectMessageText(message)}</p>
    </article>
  );
}

export const AssistantStream = memo(AssistantStreamComponent);
