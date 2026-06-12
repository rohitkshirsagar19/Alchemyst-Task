import { AssistantStream } from "@/components/chat/AssistantStream";
import { ConnectionBanner } from "@/components/chat/ConnectionBanner";
import { MessageInput } from "@/components/chat/MessageInput";
import { ToolCallCard } from "@/components/chat/ToolCallCard";
import { Panel } from "@/components/layout/Panel";

export function ChatPanel() {
  return (
    <Panel
      title="Chat Panel"
      description="Frontend shell for streaming responses and tool interruptions."
      headerSlot={<ConnectionBanner />}
    >
      <div className="stack">
        <article className="card">
          <p className="card__label">User message</p>
          <p className="card__body">The transport and protocol state machine will be added in the next phase.</p>
        </article>
        <AssistantStream />
        <ToolCallCard />
      </div>
      <MessageInput />
    </Panel>
  );
}
