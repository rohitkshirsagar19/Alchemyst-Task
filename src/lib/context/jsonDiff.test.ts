import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffJson } from "@/lib/context/jsonDiff";
import type { JsonObject } from "@/lib/protocol/types";

describe("diffJson", () => {
  it("detects added top-level key", () => {
    assert.deepEqual(diffJson({}, { report: "Q3" }), [{ kind: "added", path: "$.report", newValue: "Q3" }]);
  });

  it("detects removed top-level key", () => {
    assert.deepEqual(diffJson({ old: true }, {}), [{ kind: "removed", path: "$.old", oldValue: true }]);
  });

  it("detects changed primitive value", () => {
    assert.deepEqual(diffJson({ pages: 4 }, { pages: 5 }), [{ kind: "changed", path: "$.pages", oldValue: 4, newValue: 5 }]);
  });

  it("detects changed nested value", () => {
    assert.deepEqual(diffJson({ a: { b: "x" } }, { a: { b: "y" } }), [{ kind: "changed", path: "$.a.b", oldValue: "x", newValue: "y" }]);
  });

  it("detects array value changed by index", () => {
    assert.deepEqual(diffJson({ rows: [1, 2] }, { rows: [1, 3] }), [{ kind: "changed", path: "$.rows[1]", oldValue: 2, newValue: 3 }]);
  });

  it("detects added nested object key", () => {
    assert.deepEqual(diffJson({ a: {} }, { a: { b: 1 } }), [{ kind: "added", path: "$.a.b", newValue: 1 }]);
  });

  it("detects removed nested object key", () => {
    assert.deepEqual(diffJson({ a: { b: 1 } }, { a: {} }), [{ kind: "removed", path: "$.a.b", oldValue: 1 }]);
  });

  it("treats first snapshot as root add", () => {
    assert.deepEqual(diffJson(undefined, { a: 1 }), [{ kind: "added", path: "$", newValue: { a: 1 } }]);
  });

  it("large object diff does not crash", () => {
    const previous: JsonObject = {};
    const next: JsonObject = {};
    for (let index = 0; index < 1000; index += 1) {
      previous[`key_${index}`] = index;
      next[`key_${index}`] = index;
    }
    next.key_999 = "changed";
    assert.deepEqual(diffJson(previous, next), [{ kind: "changed", path: "$.key_999", oldValue: 999, newValue: "changed" }]);
  });
});
