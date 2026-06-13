"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContextInspector } from "@/components/context/ContextInspector";
import { TraceTimeline } from "@/components/timeline/TraceTimeline";
import type { TimelineEvent } from "@/lib/timeline/types";

export function AppShell() {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [selectedChatElementId, setSelectedChatElementId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  function appendTimelineEvent(event: TimelineEvent): void {
    setTimelineEvents((current) => [...current, event].slice(-600));
  }

  function handleSelectChatElement(elementId: string | null): void {
    setSelectedChatElementId(elementId);
    if (!elementId) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleSelectCallId(callId: string | null): void {
    setSelectedCallId(callId);
    if (!callId) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.querySelector(`[data-timeline-call-id="${CSS.escape(callId)}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

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
        <ChatPanel
          onSelectCallId={handleSelectCallId}
          onTimelineEvent={appendTimelineEvent}
          selectedCallId={selectedCallId}
          selectedChatElementId={selectedChatElementId}
        />
        <TraceTimeline
          events={timelineEvents}
          onSelectCallId={handleSelectCallId}
          onSelectChatElement={handleSelectChatElement}
          selectedCallId={selectedCallId}
          selectedChatElementId={selectedChatElementId}
        />
        <ContextInspector />
      </section>
    </main>
  );
}
