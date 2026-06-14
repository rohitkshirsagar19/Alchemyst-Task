"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContextInspector } from "@/components/context/ContextInspector";
import { TraceTimeline } from "@/components/timeline/TraceTimeline";
import type { JsonValue } from "@/lib/protocol/types";
import { diffJson } from "@/lib/context/jsonDiff";
import {
  initialContextInspectorState,
  type ContextInspectorState,
  type ContextSnapshotRecord,
} from "@/lib/context/types";
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
    setContextState((current) => {
      const existingHistory = current.historiesById[snapshot.contextId];
      if (existingHistory?.snapshots.some((entry) => entry.seq === snapshot.seq)) {
        return current;
      }

      const previous = existingHistory?.snapshots.at(-1);
      const record: ContextSnapshotRecord = {
        id: `${snapshot.contextId}:${snapshot.seq}`,
        contextId: snapshot.contextId,
        seq: snapshot.seq,
        timestamp: Date.now(),
        data: snapshot.data,
        diffFromPrevious: diffJson(previous?.data, snapshot.data),
        approxSizeBytes: new Blob([JSON.stringify(snapshot.data)]).size,
      };
      const snapshots = [...(existingHistory?.snapshots ?? []), record];
      const shouldAutoSelect = !existingHistory || !existingHistory.isUserScrubbing || current.selectedContextId === snapshot.contextId;

      return {
        ...current,
        selectedContextId: current.selectedContextId ?? snapshot.contextId,
        historiesById: {
          ...current.historiesById,
          [snapshot.contextId]: {
            contextId: snapshot.contextId,
            snapshots,
            selectedIndex: shouldAutoSelect ? snapshots.length - 1 : existingHistory.selectedIndex,
            isUserScrubbing: existingHistory?.isUserScrubbing ?? false,
          },
        },
      };
    });
  }

  function selectContextSnapshot(contextId: string, index?: number): void {
    setContextState((current) => {
      const history = current.historiesById[contextId];
      if (!history) {
        return { ...current, selectedContextId: contextId };
      }

      const selectedIndex = clamp(index ?? history.selectedIndex, 0, Math.max(0, history.snapshots.length - 1));
      return {
        ...current,
        selectedContextId: contextId,
        historiesById: {
          ...current.historiesById,
          [contextId]: {
            ...history,
            selectedIndex,
            isUserScrubbing: selectedIndex !== history.snapshots.length - 1,
          },
        },
      };
    });

    window.requestAnimationFrame(() => {
      document.getElementById("context-inspector")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function selectLatestContextSnapshot(contextId: string): void {
    setContextState((current) => {
      const history = current.historiesById[contextId];
      if (!history) {
        return current;
      }

      return {
        ...current,
        selectedContextId: contextId,
        historiesById: {
          ...current.historiesById,
          [contextId]: {
            ...history,
            selectedIndex: Math.max(0, history.snapshots.length - 1),
            isUserScrubbing: false,
          },
        },
      };
    });
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
