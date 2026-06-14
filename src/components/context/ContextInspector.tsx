import { DiffView } from "@/components/context/DiffView";
import { JsonTree } from "@/components/context/JsonTree";
import { SnapshotHistory } from "@/components/context/SnapshotHistory";
import { Panel } from "@/components/layout/Panel";
import type { ContextInspectorState } from "@/lib/context/types";

type ContextInspectorProps = {
  contextState: ContextInspectorState;
  onSelectContext: (contextId: string, index?: number) => void;
  onSelectLatest: (contextId: string) => void;
};

export function ContextInspector({ contextState, onSelectContext, onSelectLatest }: ContextInspectorProps) {
  const histories = Object.values(contextState.historiesById).sort((left, right) => left.contextId.localeCompare(right.contextId));
  const selectedHistory = histories.find((history) => history.contextId === contextState.selectedContextId) ?? histories[0];
  const selectedSnapshot = selectedHistory?.snapshots[selectedHistory.selectedIndex] ?? null;

  return (
    <section id="context-inspector">
      <Panel
        title="Context Inspector"
        description="Snapshot history, lazy JSON tree, and diffs."
        headerSlot={selectedHistory ? <span className="pill">{selectedHistory.contextId}</span> : undefined}
      >
        <div className="stack">
          <SnapshotHistory
            histories={histories}
            onSelectContext={onSelectContext}
            onSelectLatest={onSelectLatest}
            selectedContextId={selectedHistory?.contextId}
          />
          <DiffView snapshot={selectedSnapshot} />
          <JsonTree snapshot={selectedSnapshot} />
        </div>
      </Panel>
    </section>
  );
}
