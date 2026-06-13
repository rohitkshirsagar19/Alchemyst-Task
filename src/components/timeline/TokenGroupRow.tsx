import { memo, useState } from "react";
import type { TokenGroupTimelineEvent } from "@/lib/timeline/types";

type TokenGroupRowProps = {
  event: TokenGroupTimelineEvent;
  isSelected: boolean;
  onSelect: (event: TokenGroupTimelineEvent) => void;
};

function TokenGroupRowComponent({ event, isSelected, onSelect }: TokenGroupRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`timeline-row timeline-row--token${isSelected ? " timeline-row--selected" : ""}`} data-timeline-id={event.id}>
      <button className="timeline-row__main" onClick={() => onSelect(event)} type="button">
        <span className="timeline-row__direction">inbound</span>
        <span className="timeline-row__content">
          <span className="timeline-row__title">TOKEN_GROUP</span>
          <span className="timeline-row__summary">{event.summary}</span>
          <span className="timeline-row__meta">stream {event.streamId} · seq {event.seqStart}-{event.seqEnd}</span>
        </span>
      </button>
      <button className="timeline-row__toggle" onClick={() => setExpanded((value) => !value)} type="button">
        {expanded ? "Hide" : "Text"}
      </button>
      {expanded ? <pre className="timeline-row__payload">{event.text}</pre> : null}
    </article>
  );
}

export const TokenGroupRow = memo(TokenGroupRowComponent);
