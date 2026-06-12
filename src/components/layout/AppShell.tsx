import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContextInspector } from "@/components/context/ContextInspector";
import { TraceTimeline } from "@/components/timeline/TraceTimeline";

export function AppShell() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="hero__eyebrow">Agent Console</p>
          <h1 className="hero__title">Phase 1 frontend scaffold for the Alchemyst agent assignment.</h1>
        </div>
        <p className="hero__summary">
          This shell reserves the chat, trace, and context surfaces required by the assignment while keeping the
          implementation intentionally minimal before protocol work begins.
        </p>
      </section>

      <section className="app-grid">
        <ChatPanel />
        <TraceTimeline />
        <ContextInspector />
      </section>
    </main>
  );
}
