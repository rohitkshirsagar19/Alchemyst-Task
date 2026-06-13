import type { TimelineEvent, TimelineEventDirection, TimelineEventKind, TimelineRowEvent } from "@/lib/timeline/types";
import { groupTokenEvents } from "@/lib/timeline/tokenGrouper";

export interface TimelineFiltersState {
  kind: TimelineEventKind | "ALL";
  direction: TimelineEventDirection | "ALL";
  query: string;
}

export const defaultTimelineFilters: TimelineFiltersState = {
  kind: "ALL",
  direction: "ALL",
  query: "",
};

export function selectTimelineRows(events: TimelineEvent[], filters: TimelineFiltersState): TimelineRowEvent[] {
  const grouped = groupTokenEvents(events);
  const normalizedQuery = filters.query.trim().toLowerCase();

  return grouped.filter((event) => {
    if (filters.kind !== "ALL" && event.kind !== filters.kind) {
      return false;
    }

    if (filters.direction !== "ALL" && event.direction !== filters.direction) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return searchableText(event).includes(normalizedQuery);
  });
}

export function searchableText(event: TimelineRowEvent): string {
  return [
    event.title,
    event.summary,
    event.callId,
    event.streamId,
    event.contextId,
    event.payloadPreview,
    "text" in event ? event.text : undefined,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}
