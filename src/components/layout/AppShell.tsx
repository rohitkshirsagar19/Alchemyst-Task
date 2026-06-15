"use client";

import { useMemo, useState } from "react";
import { ChatPanel, type ShellConnectionSummary } from "@/components/chat/ChatPanel";
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

const initialShellConnection: ShellConnectionSummary = {
  status: "idle",
  wsUrl: "ws://localhost:4747/ws",
  lastSeq: 0,
  nextSeq: 1,
  hasActiveStream: false,
};

export function AppShell() {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [contextState, setContextState] = useState<ContextInspectorState>(initialContextInspectorState);
  const [selectedChatElementId, setSelectedChatElementId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [shellConnection, setShellConnection] = useState<ShellConnectionSummary>(initialShellConnection);

  const protocolSignals = useMemo(() => {
    let pongObserved = false;
    let toolAckObserved = false;
    let resumeObserved = false;

    for (const event of timelineEvents) {
      if (event.direction !== "outbound") {
        continue;
      }

      if (event.title === "PONG") {
        pongObserved = true;
      }
      if (event.title === "TOOL_ACK") {
        toolAckObserved = true;
      }
      if (event.title === "RESUME") {
        resumeObserved = true;
      }
    }

    return { pongObserved, toolAckObserved, resumeObserved };
  }, [timelineEvents]);

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
      <header className="app-header">
        <div className="app-header__title-group">
          <div>
            <p className="app-header__eyebrow">Alchemyst Agent Console</p>
            <h1 className="app-header__title">Agent Console</h1>
          </div>
          <p className="app-header__summary">Streaming protocol client for the Alchemyst agent server.</p>
        </div>
        <div className="app-header__meta">
          <span className={`pill pill--status pill--${shellConnection.status}`}>{shellConnection.status}</span>
          <span className="pill pill--shell">{shellConnection.wsUrl}</span>
          <span className="pill pill--shell">last seq {shellConnection.lastSeq}</span>
          <span className="pill pill--shell">next seq {shellConnection.nextSeq}</span>
          {shellConnection.hasActiveStream ? <span className="pill pill--shell">stream busy</span> : null}
          <span className={`pill pill--shell ${protocolSignals.pongObserved ? "pill--ok" : "pill--muted"}`}>PONG {protocolSignals.pongObserved ? "observed" : "pending"}</span>
          <span className={`pill pill--shell ${protocolSignals.toolAckObserved ? "pill--ok" : "pill--muted"}`}>TOOL_ACK {protocolSignals.toolAckObserved ? "observed" : "pending"}</span>
          <span className={`pill pill--shell ${protocolSignals.resumeObserved ? "pill--ok" : "pill--muted"}`}>RESUME {protocolSignals.resumeObserved ? "observed" : "ready"}</span>
        </div>
      </header>

      <section className="app-grid">
        <ChatPanel
          onContextSnapshot={appendContextSnapshot}
          onSelectCallId={handleSelectCallId}
          onShellConnectionChange={setShellConnection}
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
