export const createDefaultModelSpawnPoint = () => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  surfaceNormal: { x: 0, y: 1, z: 0 },
});

export const normalizeModelSpawnPoint = (spawnPoint) => {
  const normalizeVector = (vector = {}) => Object.fromEntries(
    ["x", "y", "z"].map((axis) => {
      const value = Number(vector[axis]);
      return [axis, Number.isFinite(value) ? value : 0];
    }),
  );
  const legacyPosition = spawnPoint?.spawnPoint?.position || spawnPoint?.position || {};
  const legacyRotation = spawnPoint?.spawnPoint?.rotation || spawnPoint?.rotation || {};

  return {
    position: normalizeVector({
      x: spawnPoint?.spawnX ?? legacyPosition.x,
      y: spawnPoint?.spawnY ?? legacyPosition.y,
      z: spawnPoint?.SpawnZ ?? spawnPoint?.spawnZ ?? legacyPosition.z,
    }),
    rotation: { x: 0, y: Number(spawnPoint?.spawnRotationY ?? spawnPoint?.spawnRotationalY ?? legacyRotation.y) || 0, z: 0 },
    surfaceNormal: normalizeVector(spawnPoint?.spawnSurfaceNormal || spawnPoint?.spawnPoint?.surfaceNormal || spawnPoint?.surfaceNormal || { x: 0, y: 1, z: 0 }),
  };
};

export const serializeModelSpawnPoint = (spawnPoint) => {
  const normalized = normalizeModelSpawnPoint(spawnPoint);
  return {
    spawnX: normalized.position.x,
    spawnY: normalized.position.y,
    spawnZ: normalized.position.z,
    spawnRotationY: normalized.rotation.y,
    spawnSurfaceNormal: normalized.surfaceNormal,
  };
};