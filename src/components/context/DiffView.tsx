import { DiffSummary } from "@/components/context/DiffSummary";
import type { ContextSnapshotRecord } from "@/lib/context/types";

type DiffViewProps = {
  snapshot: ContextSnapshotRecord | null;
};

export function DiffView({ snapshot }: DiffViewProps) {
  return <DiffSummary entries={snapshot?.diffFromPrevious ?? []} />;
}
