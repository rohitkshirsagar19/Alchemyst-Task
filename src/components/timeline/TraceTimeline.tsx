"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/layout/Panel";
import { TimelineFilters } from "@/components/timeline/TimelineFilters";
import { TimelineRow } from "@/components/timeline/TimelineRow";
import { TokenGroupRow } from "@/components/timeline/TokenGroupRow";
import { defaultTimelineFilters, selectTimelineRows, type TimelineFiltersState } from "@/lib/timeline/selectors";
import type { TimelineEvent, TimelineRowEvent, TokenGroupTimelineEvent } from "@/lib/timeline/types";

type TraceTimelineProps = {
  selectedContextId: string | null;
  onSelectContextSnapshot: (contextId: string, index?: number) => void;
  events: TimelineEvent[];
  selectedCallId: string | null;
  selectedChatElementId: string | null;
  onSelectCallId: (callId: string | null) => void;
  onSelectChatElement: (elementId: string | null) => void;
};

export function TraceTimeline({
  events,
  selectedCallId,
  selectedChatElementId,
  onSelectCallId,
  onSelectChatElement,
  onSelectContextSnapshot,
  selectedContextId,
}: TraceTimelineProps) {
  const [filters, setFilters] = useState<TimelineFiltersState>(defaultTimelineFilters);
  const rows = useMemo(() => selectTimelineRows(events, filters), [events, filters]);

  function handleSelect(event: TimelineRowEvent): void {
    if (event.relatedChatElementId) {
      onSelectChatElement(event.relatedChatElementId);
    }

    if (event.callId) {
      onSelectCallId(event.callId);
    }

    if (event.contextId) {
      onSelectContextSnapshot(event.contextId);
    }
  }

  return (
    <Panel
      title="Trace Timeline"
      description="Live protocol event log and diagnostics."
      headerSlot={<TimelineFilters filters={filters} onChange={setFilters} onReset={() => setFilters(defaultTimelineFilters)} />}
    >
      <div className="timeline-panel">
        <div className="timeline-panel__meta">{rows.length} rows · {events.length} raw events</div>
        <div className="timeline-panel__rows">
          {rows.length === 0 ? (
            <article className="list-row">
              <p className="list-row__label">No timeline events</p>
              <p className="list-row__detail">Connect and send a message to populate the trace.</p>
            </article>
          ) : (
            rows.map((event) => (
              isTokenGroupEvent(event) ? (
                <TokenGroupRow
                  event={event}
                  isSelected={event.relatedChatElementId === selectedChatElementId}
                  key={event.id}
                  onSelect={handleSelect}
                />
              ) : (
                <TimelineRow
                  event={event}
                  isSelected={event.callId === selectedCallId || event.relatedChatElementId === selectedChatElementId || event.contextId === selectedContextId}
                  key={event.id}
                  onSelect={handleSelect}
                />
              )
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

function isTokenGroupEvent(event: TimelineRowEvent): event is TokenGroupTimelineEvent {
  return event.kind === "TOKEN_GROUP" && "text" in event;
}
