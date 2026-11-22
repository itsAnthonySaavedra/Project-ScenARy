import assert from "node:assert/strict";
import { Buffer, File } from "node:buffer";
import test from "node:test";
import { createPlacedTour, inspectTourModel } from "./tourPackage.js";
import { createDefaultModelSpawnPoint, normalizeModelSpawnPoint, serializeModelSpawnPoint } from "./modelSpawnPoint.js";

const embeddedSpawn = { name: "PlayerSpawn", translation: [2, 0, 3] };
const bin = Buffer.alloc(44);
bin.writeUInt32LE(36, 0);
bin.write("BIN\0", 4);
[0, 0, 0, 1, 0, 0, 0, 0, 1].forEach((value, index) => bin.writeFloatLE(value, 8 + index * 4));

function modelFixture(overrides = {}) {
  const scene = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [{ name: "Walkway", mesh: 0 }, embeddedSpawn, { name: "ScenARy_Stop_1" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 0, 1] }],
    ...overrides,
  };
  const json = Buffer.from(JSON.stringify(scene));
  const padding = Buffer.alloc((4 - json.length % 4) % 4, 32);
  const header = Buffer.alloc(20);
  [0x46546c67, 2, header.length + json.length + padding.length + bin.length, json.length + padding.length, 0x4e4f534a]
    .forEach((word, index) => header.writeUInt32LE(word, index * 4));
  return new File([header, json, padding, bin], "Landmark.glb");
}

async function readModel(model) {
  const bytes = Buffer.from(await model.arrayBuffer());
  const binaryOffset = 20 + bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.deepEqual(bytes.subarray(binaryOffset), bin);
  return JSON.parse(bytes.subarray(20, binaryOffset).toString());
}

const stop = { poiId: "poi-1", position: { x: 0.2, y: 0.4, z: -0.7 } };

test("places a uniquely named stop without rewriting geometry or moving the embedded spawn", async () => {
  const result = await createPlacedTour(modelFixture(), "landmark-1", [stop]);
  assert.deepEqual(result.manifest.exhibits, [{ anchor: "ScenARy_Stop_2", poiId: "poi-1" }]);
  const scene = await readModel(result.model);
  assert.deepEqual(scene.nodes[1], embeddedSpawn);
  assert.deepEqual(scene.nodes[3], { name: "ScenARy_Stop_2", translation: [0.2, 0.4, -0.7] });
  assert.deepEqual(scene.scenes[0].nodes, [0, 1, 2, 3]);
});

test("accepts a plain GLB with no pre-authored spawn or stop anchors", async () => {
  const plain = modelFixture({ nodes: [{ name: "Cube", mesh: 0 }], scenes: [{ nodes: [0] }] });
  const result = await createPlacedTour(plain, "landmark-1", [stop]);
  const scene = await readModel(result.model);
  assert.deepEqual(scene.nodes.map((node) => node.name), ["Cube", "ScenARy_Stop_1"]);
});

test("reports invalid GLBs and required mobile decoders before preview", async () => {
  await assert.rejects(inspectTourModel(new File(["not a model"], "broken.glb")), /incomplete/);
  await assert.rejects(
    inspectTourModel(modelFixture({ extensionsRequired: ["KHR_draco_mesh_compression"] })),
    /Draco decoding on the phone/,
  );
});

test("replaces the active spawn with a single browser-authored spawn", async () => {
  const spawn = { position: { x: 3, y: 0, z: -2 }, rotation: { y: 90 } };
  const result = await createPlacedTour(modelFixture(), "landmark-1", [stop], spawn);
  const scene = await readModel(result.model);
  const spawns = scene.nodes.filter((node) => node.name === "PlayerSpawn");
  assert.equal(spawns.length, 1);
  assert.deepEqual(spawns[0].translation, [3, 0, -2]);
  assert.ok(Math.abs(spawns[0].rotation[1] - Math.SQRT1_2) < 0.0001);
});

test("rejects a non-finite stop before submission", async () => {
  await assert.rejects(
    createPlacedTour(modelFixture(), "landmark-1", [{ ...stop, position: { ...stop.position, x: Infinity } }]),
    /invalid position/,
  );
});

test("round-trips the new coordinate space while preserving old untagged spawn values", () => {
  const legacy = normalizeModelSpawnPoint({ spawnX: -2, spawnZ: 3 });
  assert.equal(serializeModelSpawnPoint(legacy).spawnCoordinateSpace, undefined);
  const saved = serializeModelSpawnPoint(createDefaultModelSpawnPoint());
  assert.equal(saved.spawnCoordinateSpace, "gltf");
  assert.equal(normalizeModelSpawnPoint(saved).coordinateSpace, "gltf");
});
