import { memo, useState } from "react";
import type { TimelineRowEvent } from "@/lib/timeline/types";

type TimelineRowProps = {
  event: TimelineRowEvent;
  isSelected: boolean;
  onSelect: (event: TimelineRowEvent) => void;
};

function TimelineRowComponent({ event, isSelected, onSelect }: TimelineRowProps) {
  const [expanded, setExpanded] = useState(false);
  const payload = typeof event.payload === "string" ? event.payload : event.payloadPreview;

  return (
    <article
      className={`timeline-row timeline-row--${event.direction}${isSelected ? " timeline-row--selected" : ""}`}
      data-timeline-call-id={event.callId}
      data-timeline-id={event.id}
    >
      <button className="timeline-row__main" onClick={() => onSelect(event)} type="button">
        <span className="timeline-row__direction">{event.direction}</span>
        <span className="timeline-row__content">
          <span className="timeline-row__title">{event.title}</span>
          <span className="timeline-row__summary">{event.summary}</span>
          <span className="timeline-row__meta">{formatMeta(event)}</span>
        </span>
      </button>
      <button className="timeline-row__toggle" onClick={() => setExpanded((value) => !value)} type="button">
        {expanded ? "Hide" : "Details"}
      </button>
      {expanded ? <pre className="timeline-row__payload">{payload}</pre> : null}
    </article>
  );
}

function formatMeta(event: TimelineRowEvent): string {
  const parts = [
    event.seq !== undefined ? `seq ${event.seq}` : undefined,
    event.seqStart !== undefined && event.seqEnd !== undefined ? `seq ${event.seqStart}-${event.seqEnd}` : undefined,
    event.streamId ? `stream ${event.streamId}` : undefined,
    event.callId ? `call ${event.callId}` : undefined,
    event.contextId ? `context ${event.contextId}` : undefined,
  ];

  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export const TimelineRow = memo(TimelineRowComponent);
