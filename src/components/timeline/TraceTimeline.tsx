import { Panel } from "@/components/layout/Panel";
import { TimelineFilters } from "@/components/timeline/TimelineFilters";
import { TimelineRow } from "@/components/timeline/TimelineRow";
import { TokenGroupRow } from "@/components/timeline/TokenGroupRow";

export function TraceTimeline() {
  return (
    <Panel
      title="Trace Timeline"
      description="Live protocol event log and diagnostics."
      headerSlot={<TimelineFilters />}
    >
      <div className="stack">
        <TokenGroupRow />
        <TimelineRow label="Connection" detail="WebSocket lifecycle events will be listed here." />
        <TimelineRow label="Tool events" detail="TOOL_CALL and TOOL_RESULT rows will be linked here." />
      </div>
    </Panel>
  );
}
