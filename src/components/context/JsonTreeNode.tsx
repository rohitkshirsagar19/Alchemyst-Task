import { memo, useState } from "react";
import type { JsonObject, JsonValue } from "@/lib/protocol/types";

type JsonTreeNodeProps = {
  label: string;
  path: string;
  value: JsonValue;
  changedPaths: Set<string>;
  depth?: number;
};

function JsonTreeNodeComponent({ label, path, value, changedPaths, depth = 0 }: JsonTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isContainer = isObject(value) || Array.isArray(value);
  const isChanged = changedPaths.has(path);

  return (
    <div className={`json-node${isChanged ? " json-node--changed" : ""}`} style={{ paddingLeft: `${depth * 0.75}rem` }}>
      <button className="json-node__row" onClick={() => isContainer && setExpanded((current) => !current)} type="button">
        <span className="json-node__toggle">{isContainer ? (expanded ? "-" : "+") : ""}</span>
        <span className="json-node__key">{label}</span>
        <span className="json-node__preview">{previewValue(value)}</span>
      </button>
      {expanded && isContainer ? (
        <div className="json-node__children">
          {childEntries(value).map(([childLabel, childValue]) => (
            <JsonTreeNode
              changedPaths={changedPaths}
              depth={depth + 1}
              key={`${path}:${childLabel}`}
              label={childLabel}
              path={childPath(path, childLabel, Array.isArray(value))}
              value={childValue}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const JsonTreeNode = memo(JsonTreeNodeComponent);

function childEntries(value: JsonValue): Array<[string, JsonValue]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [`[${index}]`, entry]);
  }

  if (isObject(value)) {
    return Object.keys(value).sort().map((key) => [key, value[key]]);
  }

  return [];
}

function childPath(parent: string, label: string, parentIsArray: boolean): string {
  if (parentIsArray) {
    return `${parent}${label}`;
  }

  return `${parent}.${label}`;
}

function previewValue(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (isObject(value)) {
    return `Object(${Object.keys(value).length} keys)`;
  }

  if (typeof value === "string") {
    const escaped = JSON.stringify(value.length > 120 ? `${value.slice(0, 120)}...` : value);
    return escaped;
  }

  return String(value);
}

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
