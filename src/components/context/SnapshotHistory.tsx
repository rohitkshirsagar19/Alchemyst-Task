import type { ContextHistory } from "@/lib/context/types";

type SnapshotHistoryProps = {
  histories: ContextHistory[];
  selectedContextId?: string;
  onSelectContext: (contextId: string, index?: number) => void;
  onSelectLatest: (contextId: string) => void;
};

export function SnapshotHistory({ histories, selectedContextId, onSelectContext, onSelectLatest }: SnapshotHistoryProps) {
  const selectedHistory = histories.find((history) => history.contextId === selectedContextId) ?? histories[0];
  const selectedSnapshot = selectedHistory?.snapshots[selectedHistory.selectedIndex];

  return (
    <article className="context-section">
      <p className="card__label">Snapshot history</p>
      {histories.length === 0 ? (
        <p className="card__body">No context history yet.</p>
      ) : (
        <div className="snapshot-history">
          <select
            className="timeline-filter"
            onChange={(event) => onSelectContext(event.target.value)}
            value={selectedHistory?.contextId}
          >
            {histories.map((history) => (
              <option key={history.contextId} value={history.contextId}>{history.contextId}</option>
            ))}
          </select>
          <p className="snapshot-history__label">
            {selectedHistory.contextId} · Snapshot {selectedHistory.selectedIndex + 1} / {selectedHistory.snapshots.length}
            {selectedSnapshot ? ` · seq ${selectedSnapshot.seq}` : ""}
          </p>
          <p className="debug-log__meta">{selectedSnapshot ? new Date(selectedSnapshot.timestamp).toLocaleTimeString() : "No snapshot selected"}</p>
          <div className="button-row">
            <button
              className="control-button control-button--muted"
              disabled={selectedHistory.selectedIndex <= 0}
              onClick={() => onSelectContext(selectedHistory.contextId, selectedHistory.selectedIndex - 1)}
              type="button"
            >
              Prev
            </button>
            <button
              className="control-button control-button--muted"
              disabled={selectedHistory.selectedIndex >= selectedHistory.snapshots.length - 1}
              onClick={() => onSelectContext(selectedHistory.contextId, selectedHistory.selectedIndex + 1)}
              type="button"
            >
              Next
            </button>
            <button
              className="control-button"
              onClick={() => onSelectLatest(selectedHistory.contextId)}
              type="button"
            >
              Latest
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
