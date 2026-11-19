import { createPoiCatalog } from "./poiCatalog.js";
import { isContentReady } from "./contentQuality.js";

const arContentTypes = ["Information", "Fun Fact", "Quiz"];

const MAX_TOUR_MODEL_BYTES = 1024 ** 3;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_ZIP_BYTES = MAX_TOUR_MODEL_BYTES + MAX_MANIFEST_BYTES + 1024 * 1024;
const MAX_SCENE_JSON_BYTES = 64 * 1024 * 1024;
const entriesExpected = new Set(["model.glb", "tour.json"]);
const decoder = new TextDecoder("utf-8", { fatal: true });

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

async function viewOf(blob, start, length) {
  if (start < 0 || length < 0 || start + length > blob.size) {
    throw new Error("This tour ZIP is incomplete. Ask for a fresh Unity export.");
  }
  return new DataView(await blob.slice(start, start + length).arrayBuffer());
}

async function readZipDirectory(file) {
  const footerStart = Math.max(0, file.size - (22 + 65535));
  const footer = await viewOf(file, footerStart, file.size - footerStart);
  let end = footer.byteLength - 22;
  while (end >= 0 && (footer.getUint32(end, true) !== 0x06054b50 ||
    end + 22 + footer.getUint16(end + 20, true) !== footer.byteLength)) end--;
  if (end < 0) throw new Error("This file is not a complete ZIP. Choose the ZIP exported by Unity.");
  const count = footer.getUint16(end + 10, true);
  const length = footer.getUint32(end + 12, true);
  const offset = footer.getUint32(end + 16, true);
  if (footer.getUint16(end + 4, true) || footer.getUint16(end + 6, true) ||
    count !== 2 || footer.getUint16(end + 8, true) !== count ||
    length > 512 * 1024 || offset + length !== footerStart + end) {
    throw new Error("The ZIP must contain exactly model.glb and tour.json at its root.");
  }

  const directory = await viewOf(file, offset, length);
  const entries = new Map();
  let position = 0;
  for (let index = 0; index < count; index++) {
    if (position + 46 > length || directory.getUint32(position, true) !== 0x02014b50) {
      throw new Error("The ZIP directory is damaged. Export the tour again in Unity.");
    }
    const nameLength = directory.getUint16(position + 28, true);
    const next = position + 46 + nameLength + directory.getUint16(position + 30, true) +
      directory.getUint16(position + 32, true);
    if (next > length) throw new Error("The ZIP directory is incomplete.");
    const name = decoder.decode(new Uint8Array(directory.buffer, position + 46, nameLength));
    const flags = directory.getUint16(position + 8, true);
    const method = directory.getUint16(position + 10, true);
    if (!entriesExpected.has(name) || entries.has(name) || flags & ~(0x080e) ||
      (method !== 0 && method !== 8) || directory.getUint16(position + 34, true)) {
      throw new Error("Choose a Unity ZIP with one model.glb and one tour.json. Encrypted or split archives are unsupported.");
    }
    const compressed = directory.getUint32(position + 20, true);
    const size = directory.getUint32(position + 24, true);
    const local = directory.getUint32(position + 42, true);
    if (!size || !compressed || size > (name === "model.glb" ? MAX_TOUR_MODEL_BYTES : MAX_MANIFEST_BYTES) ||
      local + 30 > offset || compressed > offset - local || (method === 0 && compressed !== size)) {
      throw new Error(`The ZIP entry ${name} is too large or damaged.`);
    }
    entries.set(name, { local, flags, method, size, compressed, crc: directory.getUint32(position + 16, true) });
    position = next;
  }
  if (position !== length) throw new Error("The ZIP directory has unexpected data.");
  return { entries, offset };
}

async function openZipEntry(file, name, entry, directoryOffset) {
  const header = await viewOf(file, entry.local, 30);
  if (header.getUint32(0, true) !== 0x04034b50 || header.getUint16(6, true) !== entry.flags ||
    header.getUint16(8, true) !== entry.method) throw new Error(`The ZIP entry ${name} is damaged.`);

  const nameLength = header.getUint16(26, true);
  const start = entry.local + 30 + nameLength + header.getUint16(28, true);
  const end = start + entry.compressed;
  if (end > directoryOffset ||
    decoder.decode((await viewOf(file, entry.local + 30, nameLength)).buffer) !== name) {
    throw new Error(`The ZIP entry ${name} is damaged.`);
  }
  const compressed = file.slice(start, end);
  const parts = [];
  let size = 0;
  let crc = 0xffffffff;
  let reader;
  try {
    const stream = entry.method === 0
      ? compressed.stream()
      : compressed.stream().pipeThrough(new DecompressionStream("deflate-raw"));
    reader = stream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > entry.size) {
        await reader.cancel();
        throw new Error("ZIP entry exceeds its declared size.");
      }
      for (let index = 0; index < value.length; index++) crc = crcTable[(crc ^ value[index]) & 255] ^ (crc >>> 8);
      if (entry.method === 8) parts.push(value);
    }
  } catch {
    throw new Error(`Unable to extract ${name}. Use the original Unity ZIP in an up-to-date browser.`);
  } finally {
    reader?.releaseLock();
  }
  if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) {
    throw new Error(`The ZIP entry ${name} failed its integrity check. Export it again in Unity.`);
  }
  return { blob: entry.method === 0 ? compressed : new Blob(parts), start: entry.local, end };
}

export const isTourDocumentId = (value) => typeof value === "string" && value.length > 0 && value === value.trim() &&
  !value.split("").some((character) => character === "/" || character.charCodeAt(0) <= 0x1f) &&
  value !== "." && value !== ".." && new TextEncoder().encode(value).length <= 1500;

export function readTourManifest(raw) {
  const landmarkId = raw?.landmarkId ?? "";
  if (raw?.version !== 2 || (landmarkId !== "" && !isTourDocumentId(landmarkId)) ||
    !Array.isArray(raw.exhibits) || raw.exhibits.length < 1 || raw.exhibits.length > 24) {
    throw new Error("tour.json must be a version 2 ScenARy export with 1 to 24 trigger links.");
  }
  const names = new Set();
  const exhibits = raw.exhibits.map((stop, index) => {
    const { anchor, poiId } = stop ?? {};
    if (typeof anchor !== "string" || !anchor || anchor !== anchor.trim() || anchor.length > 160 ||
      names.has(anchor) || !isTourDocumentId(poiId)) throw new Error(`Trigger ${index + 1} has a duplicate anchor or an invalid POI ID.`);
    names.add(anchor);
    return { anchor, poiId };
  });
  return { version: 2, landmarkId, exhibits };
}

export function resolveTourLandmarkId(manifest, pois) {
  const byId = new Map(pois.map((poi) => [poi.id, poi]));
  const landmarkId = manifest.landmarkId || byId.get(manifest.exhibits[0].poiId)?.landmarkId;
  if (!isTourDocumentId(landmarkId) ||
    manifest.exhibits.some(({ poiId }) => byId.get(poiId)?.landmarkId !== landmarkId)) {
    throw new Error("The ZIP links to missing POIs or to POIs from different landmarks. Refresh the POI list in Unity and re-export.");
  }
  return landmarkId;
}

export function validateTourRecords(manifest, landmark, pois, contents, options) {
  const landmarkId = resolveTourLandmarkId(manifest, pois);
  const institutionId = landmark?.institutionId;
  if (landmark?.id !== landmarkId || !isTourDocumentId(institutionId)) {
    throw new Error("The landmark in this ZIP no longer exists or has no institution.");
  }
  const catalog = createPoiCatalog(institutionId, landmark, pois, contents, options);
  const available = new Map(catalog.pois.map((poi) => [poi.id, poi]));
  const stops = manifest.exhibits.map(({ anchor, poiId }) => {
    const poi = available.get(poiId);
    if (!poi) throw new Error(`The POI for “${anchor}” is unavailable. It must belong to this landmark and have published content.`);
    return { anchor, ...poi };
  });
  const linkedContentIds = new Set([
    ...(Array.isArray(landmark.contentIds)
      ? landmark.contentIds
      : []),
    ...pois.flatMap((poi) => Array.isArray(poi.contentIds) ? poi.contentIds : []),
  ]);
  const pairedARContentIds = contents
    .filter((item) =>
      linkedContentIds.has(item.id) &&
      item.institutionId === institutionId &&
      item.status === "Awaiting Content" &&
      arContentTypes.includes(item.type) &&
      isContentReady(item),
    )
    .map((item) => item.id);
  return {
    landmark,
    institutionId,
    stops,
    pairedARContentIds,
    manifest: { ...manifest, landmarkId },
  };
}

async function validateModelAnchors(model, exhibits) {
  if (model.size < 20) throw new Error("model.glb is too short to be a GLB.");
  const header = await viewOf(model, 0, 20);
  const jsonLength = header.getUint32(12, true);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== model.size || header.getUint32(16, true) !== 0x4e4f534a ||
    jsonLength > MAX_SCENE_JSON_BYTES || jsonLength > model.size - 20) {
    throw new Error("model.glb must be a valid GLB 2 file with a readable scene.");
  }
  let scene;
  try {
    scene = JSON.parse(decoder.decode((await viewOf(model, 20, jsonLength)).buffer).replace(/\0+$/, ""));
  } catch {
    throw new Error("model.glb has a damaged scene description.");
  }
  if (!scene || typeof scene !== "object" ||
    (scene.images != null && !Array.isArray(scene.images)) ||
    (scene.buffers != null && !Array.isArray(scene.buffers))) throw new Error("model.glb has invalid scene metadata.");
  if ((scene.images ?? []).concat(scene.buffers ?? []).some((part) =>
    typeof part?.uri === "string" && !part.uri.startsWith("data:"))) {
    throw new Error("model.glb references external files. Export the model with its textures and geometry embedded.");
  }
  const embedded = scene.buffers?.find((buffer) => buffer?.uri == null);
  if (embedded) {
    const binary = await viewOf(model, 20 + jsonLength, 8);
    const binaryLength = binary.getUint32(0, true);
    if (binary.getUint32(4, true) !== 0x004e4942 || !Number.isInteger(embedded.byteLength) ||
      embedded.byteLength <= 0 || binaryLength < embedded.byteLength || 28 + jsonLength + binaryLength > model.size) {
      throw new Error("model.glb is missing its embedded geometry or texture data.");
    }
  }
  const nodes = scene.nodes;
  const roots = Number.isInteger(scene.scene) ? scene.scenes?.[scene.scene]?.nodes : null;
  if (!Array.isArray(nodes) || !Array.isArray(roots) || roots.length === 0) {
    throw new Error("model.glb has no default scene. Re-export the model with the tour objects in its default scene.");
  }
  const names = new Map();
  const visited = new Set();
  const pending = [...roots];
  let hasGeometry = false;
  while (pending.length) {
    const index = pending.pop();
    const node = nodes[index];
    if (!Number.isInteger(index) || index < 0 || !node || visited.has(index)) {
      throw new Error("model.glb has an invalid node tree in its default scene.");
    }
    visited.add(index);
    if (typeof node.name === "string") names.set(node.name, (names.get(node.name) ?? 0) + 1);
    const mesh = Number.isInteger(node.mesh) ? scene.meshes?.[node.mesh] : null;
    if (Array.isArray(mesh?.primitives) && mesh.primitives.some((primitive) =>
      Number.isInteger(primitive?.attributes?.POSITION) && scene.accessors?.[primitive.attributes.POSITION]?.count > 0)) {
      hasGeometry = true;
    }
    if (node.children != null && !Array.isArray(node.children)) throw new Error("model.glb has invalid child nodes.");
    for (const child of node.children ?? []) pending.push(child);
  }
  if (!hasGeometry) throw new Error("model.glb has no renderable geometry in its default scene.");
  const invalid = exhibits.filter(({ anchor }) => names.get(anchor) !== 1);
  if (invalid.length) throw new Error(`Every trigger must name one object in the default scene. Check: ${invalid.map(({ anchor }) => anchor).join(", ")}.`);
}

export async function readTourPackage(file) {
  if (!file.name?.toLowerCase().endsWith(".zip") || file.size > MAX_ZIP_BYTES) {
    throw new Error("Choose the Unity tour ZIP containing a GLB of 1 GB or smaller.");
  }
  const { entries, offset } = await readZipDirectory(file);
  const metadata = await openZipEntry(file, "tour.json", entries.get("tour.json"), offset);
  let raw;
  try { raw = JSON.parse(await metadata.blob.text()); }
  catch { throw new Error("tour.json is not valid JSON. Export it again in Unity."); }
  const manifest = readTourManifest(raw);
  const model = await openZipEntry(file, "model.glb", entries.get("model.glb"), offset);
  if (model.start < metadata.end && metadata.start < model.end) throw new Error("The ZIP entries overlap.");
  await validateModelAnchors(model.blob, manifest.exhibits);
  return { manifest, model: model.blob, name: file.name };
}
