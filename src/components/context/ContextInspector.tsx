import { DiffView } from "@/components/context/DiffView";
import { JsonTree } from "@/components/context/JsonTree";
import { SnapshotHistory } from "@/components/context/SnapshotHistory";
import { Panel } from "@/components/layout/Panel";

export function ContextInspector() {
  return (
    <Panel
      title="Context Panel"
      description="Reserved for snapshots, diffs, and history controls."
    >
      <div className="stack">
        <JsonTree />
        <DiffView />
        <SnapshotHistory />
      </div>
    </Panel>
  );
}
