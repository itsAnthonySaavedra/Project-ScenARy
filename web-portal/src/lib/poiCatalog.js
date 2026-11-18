const exhibitContentTypes = ["Information", "Fun Fact", "Quiz"];
const text = (value) => typeof value === "string" ? value.trim() : "";

export function createPoiCatalog(institutionId, landmark, pois, contents) {
  if (!institutionId || landmark?.institutionId !== institutionId) return null;

  const publishedTypes = new Map();
  for (const item of contents) {
    if (item.institutionId !== institutionId || text(item.status).toLowerCase() !== "published") continue;
    const type = exhibitContentTypes.find((allowed) => allowed.toLowerCase() === text(item.type).toLowerCase());
    if (type) publishedTypes.set(item.id, type);
  }

  const entries = pois
    .filter((poi) => poi.institutionId === institutionId && poi.landmarkId === landmark.id)
    .flatMap((poi) => {
      const linkedTypes = new Set(Array.isArray(poi.contentIds) ? poi.contentIds.map((id) => publishedTypes.get(id)) : []);
      const contentTypes = exhibitContentTypes.filter((type) => linkedTypes.has(type));
      return contentTypes.length ? [{ id: poi.id, name: text(poi.name) || "Unnamed POI", contentTypes }] : [];
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  return {
    version: 1,
    landmarkId: landmark.id,
    landmarkName: text(landmark.landmarkName) || text(landmark.institutionName) || "Landmark",
    pois: entries,
  };
}

export function downloadPoiCatalog(catalog) {
  const name = catalog.landmarkName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const blob = new Blob([JSON.stringify(catalog, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = (name || "landmark") + "-pois.json";
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
