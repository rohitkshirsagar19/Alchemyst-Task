import type { JsonDiffEntry } from "@/lib/context/jsonDiff";

type DiffSummaryProps = {
  entries: JsonDiffEntry[];
};

export function DiffSummary({ entries }: DiffSummaryProps) {
  const added = entries.filter((entry) => entry.kind === "added").length;
  const removed = entries.filter((entry) => entry.kind === "removed").length;
  const changed = entries.filter((entry) => entry.kind === "changed").length;

  return (
    <article className="context-section">
      <p className="card__label">Diff summary</p>
      <div className="diff-counts">
        <span>Added: {added}</span>
        <span>Removed: {removed}</span>
        <span>Changed: {changed}</span>
      </div>
      <div className="diff-list">
        {entries.length === 0 ? (
          <p className="card__body">No changes from previous snapshot.</p>
        ) : (
          entries.slice(0, 180).map((entry) => (
            <div className={`diff-entry diff-entry--${entry.kind}`} key={`${entry.kind}:${entry.path}`}>
              <span>{symbolFor(entry.kind)}</span>
              <code>{entry.path}</code>
              <span>{formatDiffValue(entry)}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function symbolFor(kind: JsonDiffEntry["kind"]): string {
  if (kind === "added") {
    return "+";
  }

  if (kind === "removed") {
    return "-";
  }

  return "~";
}

function formatDiffValue(entry: JsonDiffEntry): string {
  if (entry.kind === "added") {
    return `= ${preview(entry.newValue)}`;
  }

  if (entry.kind === "removed") {
    return preview(entry.oldValue);
  }

  return `${preview(entry.oldValue)} -> ${preview(entry.newValue)}`;
}

function preview(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (!serialized) {
    return "undefined";
  }

  return serialized.length > 160 ? `${serialized.slice(0, 160)}...` : serialized;
}
