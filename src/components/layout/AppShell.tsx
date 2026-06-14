"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContextInspector } from "@/components/context/ContextInspector";
import { TraceTimeline } from "@/components/timeline/TraceTimeline";
import {
  appendContextSnapshotState,
  selectContextSnapshotState,
  selectLatestContextSnapshotState,
} from "@/lib/context/contextState";
import {
  initialContextInspectorState,
  type ContextInspectorState,
} from "@/lib/context/types";
import type { JsonValue } from "@/lib/protocol/types";
import type { TimelineEvent } from "@/lib/timeline/types";

export function AppShell() {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [contextState, setContextState] = useState<ContextInspectorState>(initialContextInspectorState);
  const [selectedChatElementId, setSelectedChatElementId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  function appendTimelineEvent(event: TimelineEvent): void {
    setTimelineEvents((current) => [...current, event].slice(-600));
  }

  function appendContextSnapshot(snapshot: { contextId: string; seq: number; data: JsonValue }): void {
    setContextState((current) => appendContextSnapshotState(current, snapshot));
  }

  function selectContextSnapshot(contextId: string, index?: number): void {
    setContextState((current) => selectContextSnapshotState(current, contextId, index));

    window.requestAnimationFrame(() => {
      document.getElementById("context-inspector")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function selectLatestContextSnapshot(contextId: string): void {
    setContextState((current) => selectLatestContextSnapshotState(current, contextId));
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
          onContextSnapshot={appendContextSnapshot}
          onSelectCallId={handleSelectCallId}
          onTimelineEvent={appendTimelineEvent}
          selectedCallId={selectedCallId}
          selectedChatElementId={selectedChatElementId}
        />
        <TraceTimeline
          events={timelineEvents}
          onSelectCallId={handleSelectCallId}
          onSelectChatElement={handleSelectChatElement}
          onSelectContextSnapshot={selectContextSnapshot}
          selectedCallId={selectedCallId}
          selectedChatElementId={selectedChatElementId}
          selectedContextId={contextState.selectedContextId ?? null}
        />
        <ContextInspector
          contextState={contextState}
          onSelectContext={selectContextSnapshot}
          onSelectLatest={selectLatestContextSnapshot}
        />
      </section>
    </main>
  );
}
