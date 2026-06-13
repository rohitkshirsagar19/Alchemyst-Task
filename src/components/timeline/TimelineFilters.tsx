import type { TimelineEventDirection, TimelineEventKind } from "@/lib/timeline/types";
import type { TimelineFiltersState } from "@/lib/timeline/selectors";

const KIND_OPTIONS: Array<TimelineEventKind | "ALL"> = [
  "ALL",
  "USER_MESSAGE",
  "TOKEN_GROUP",
  "TOOL_CALL",
  "TOOL_ACK",
  "TOOL_RESULT",
  "CONTEXT_SNAPSHOT",
  "PING",
  "PONG",
  "STREAM_END",
  "ERROR",
  "CONNECTION",
  "INVALID_MESSAGE",
  "BUFFERED",
  "DUPLICATE_IGNORED",
  "TOOL_ACK_SKIPPED",
];

const DIRECTION_OPTIONS: Array<TimelineEventDirection | "ALL"> = ["ALL", "inbound", "outbound", "internal"];

type TimelineFiltersProps = {
  filters: TimelineFiltersState;
  onChange: (filters: TimelineFiltersState) => void;
  onReset: () => void;
};

export function TimelineFilters({ filters, onChange, onReset }: TimelineFiltersProps) {
  return (
    <div className="timeline-filters">
      <select
        aria-label="Filter timeline by event type"
        className="timeline-filter"
        onChange={(event) => onChange({ ...filters, kind: event.target.value as TimelineFiltersState["kind"] })}
        value={filters.kind}
      >
        {KIND_OPTIONS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
      </select>
      <select
        aria-label="Filter timeline by direction"
        className="timeline-filter"
        onChange={(event) => onChange({ ...filters, direction: event.target.value as TimelineFiltersState["direction"] })}
        value={filters.direction}
      >
        {DIRECTION_OPTIONS.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
      </select>
      <input
        aria-label="Search timeline"
        className="timeline-search"
        onChange={(event) => onChange({ ...filters, query: event.target.value })}
        placeholder="Search trace"
        value={filters.query}
      />
      <button className="timeline-reset" onClick={onReset} type="button">Clear</button>
    </div>
  );
}
