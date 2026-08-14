// Test stroke logic from lib/strokes.mjs
// Run: npm test

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createStore,
  beginStroke,
  addPoint,
  undo,
  clearStrokes,
  strokeCount,
  pointCount,
  getBoundingBox,
  serializeStrokes,
  deserializeStrokes,
  pressureToWidth,
} from "../lib/strokes.mjs";

describe("stroke collection", () => {
  test("createStore starts empty", () => {
    const store = createStore();
    assert.equal(strokeCount(store), 0);
    assert.equal(pointCount(store), 0);
  });

  test("beginStroke creates a stroke with one point", () => {
    const store = createStore();
    beginStroke(store, { x: 10, y: 20 });
    assert.equal(strokeCount(store), 1);
    assert.equal(pointCount(store), 1);
    assert.deepEqual(store[0], [{ x: 10, y: 20, pressure: 0.5 }]);
  });

  test("beginStroke applies default pressure", () => {
    const store = createStore();
    beginStroke(store, { x: 0, y: 0 });
    assert.equal(store[0][0].pressure, 0.5);
  });

  test("beginStroke preserves explicit pressure", () => {
    const store = createStore();
    beginStroke(store, { x: 0, y: 0, pressure: 0.8 });
    assert.equal(store[0][0].pressure, 0.8);
  });

  test("beginStroke clamps pressure to [0,1]", () => {
    const store = createStore();
    beginStroke(store, { x: 0, y: 0, pressure: 2 });
    assert.equal(store[0][0].pressure, 1);
    beginStroke(store, { x: 1, y: 1, pressure: -1 });
    assert.equal(store[1][0].pressure, 0);
  });

  test("addPoint appends to last stroke", () => {
    const store = createStore();
    beginStroke(store, { x: 10, y: 10 });
    addPoint(store, { x: 20, y: 20 });
    addPoint(store, { x: 30, y: 30 });
    assert.equal(strokeCount(store), 1);
    assert.equal(pointCount(store), 3);
  });

  test("addPoint on empty store is a no-op", () => {
    const store = createStore();
    addPoint(store, { x: 5, y: 5 });
    assert.equal(strokeCount(store), 0);
  });
});

describe("undo", () => {
  test("undo removes last stroke", () => {
    const store = createStore();
    beginStroke(store, { x: 10, y: 10 });
    beginStroke(store, { x: 20, y: 20 });
    assert.equal(strokeCount(store), 2);
    assert.equal(undo(store), true);
    assert.equal(strokeCount(store), 1);
  });

  test("undo on empty store returns false", () => {
    const store = createStore();
    assert.equal(undo(store), false);
    assert.equal(strokeCount(store), 0);
  });
});

describe("clearStrokes", () => {
  test("clear empties all strokes", () => {
    const store = createStore();
    beginStroke(store, { x: 10, y: 10 });
    addPoint(store, { x: 20, y: 20 });
    beginStroke(store, { x: 30, y: 30 });
    assert.equal(strokeCount(store), 2);
    clearStrokes(store);
    assert.equal(strokeCount(store), 0);
    assert.equal(pointCount(store), 0);
  });
});

describe("serialization", () => {
  test("serialize → deserialize round-trip", () => {
    const store = createStore();
    beginStroke(store, { x: 10, y: 10, pressure: 0.3 });
    addPoint(store, { x: 20, y: 20, pressure: 0.7 });
    beginStroke(store, { x: 30, y: 30 });

    const json = serializeStrokes(store);
    const restored = deserializeStrokes(json);

    assert.equal(strokeCount(restored), 2);
    assert.equal(pointCount(restored), 3);
    assert.deepEqual(restored, store);
  });

  test("serialize empty store", () => {
    const store = createStore();
    const json = serializeStrokes(store);
    assert.equal(json, "[]");
    const restored = deserializeStrokes(json);
    assert.equal(strokeCount(restored), 0);
  });

  test("deserialize throws on invalid JSON shape", () => {
    assert.throws(() => deserializeStrokes('{"x":1}'), /expected array/);
    assert.throws(() => deserializeStrokes('[42]'), /expected array of points/);
  });
});

describe("getBoundingBox", () => {
  test("returns null for empty store", () => {
    const store = createStore();
    assert.equal(getBoundingBox(store), null);
  });

  test("computes correct bounding box", () => {
    const store = createStore();
    beginStroke(store, { x: 10, y: 20 });
    addPoint(store, { x: 50, y: 80 });
    beginStroke(store, { x: 30, y: 60 });

    const bb = getBoundingBox(store, 0);
    assert.equal(bb.minX, 10);
    assert.equal(bb.minY, 20);
    assert.equal(bb.maxX, 50);
    assert.equal(bb.maxY, 80);
    assert.equal(bb.width, 40);
    assert.equal(bb.height, 60);
  });

  test("applies padding", () => {
    const store = createStore();
    beginStroke(store, { x: 100, y: 100 });
    const bb = getBoundingBox(store, 10);
    assert.equal(bb.minX, 90);
    assert.equal(bb.minY, 90);
    assert.equal(bb.width, 20);
  });
});

describe("pressureToWidth", () => {
  test("maps pressure 0 to min width", () => {
    assert.equal(pressureToWidth(0, 2, 5), 2);
  });

  test("maps pressure 1 to max width", () => {
    assert.equal(pressureToWidth(1, 2, 5), 5);
  });

  test("maps pressure 0.5 to midpoint", () => {
    assert.equal(pressureToWidth(0.5, 2, 4), 3);
  });

  test("clamps out-of-range pressure", () => {
    assert.equal(pressureToWidth(2, 2, 5), 5);
    assert.equal(pressureToWidth(-1, 2, 5), 2);
  });
});
