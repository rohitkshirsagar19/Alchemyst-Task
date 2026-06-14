import { JsonTreeNode } from "@/components/context/JsonTreeNode";
import type { ContextSnapshotRecord } from "@/lib/context/types";

type JsonTreeProps = {
  snapshot: ContextSnapshotRecord | null;
};

export function JsonTree({ snapshot }: JsonTreeProps) {
  if (!snapshot) {
    return (
      <article className="context-section">
        <p className="card__label">JSON tree</p>
        <p className="card__body">No context snapshots received yet.</p>
      </article>
    );
  }

  const changedPaths = new Set(snapshot.diffFromPrevious.map((entry) => entry.path));

  return (
    <article className="context-section">
      <div className="context-section__header">
        <p className="card__label">JSON tree</p>
        <p className="debug-log__meta">{formatBytes(snapshot.approxSizeBytes)}</p>
      </div>
      <div className="json-tree">
        <JsonTreeNode changedPaths={changedPaths} label={snapshot.contextId} path="$" value={snapshot.data} />
      </div>
    </article>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  return `${Math.round(bytes / 1024)}KB`;
}
