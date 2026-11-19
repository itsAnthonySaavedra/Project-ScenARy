import assert from "node:assert/strict";
import test from "node:test";
import { createPoiCatalog } from "./poiCatalog.js";

const landmark = { id: "landmark-1", institutionId: "institution-1" };
const poi = {
  id: "poi-1",
  institutionId: "institution-1",
  landmarkId: "landmark-1",
  name: "Gallery",
  contentIds: ["ar-draft", "ar-incomplete"],
};
const draft = {
  id: "ar-draft",
  institutionId: "institution-1",
  title: "Gallery information",
  type: "Information",
  scope: "POI",
  status: "Awaiting Content",
  data: { description: "A useful description." },
};

test("includes only complete AR drafts when previewing a tour for development", () => {
  const contents = [
    draft,
    {
      ...draft,
      id: "ar-incomplete",
      data: { description: " " },
    },
  ];
  assert.deepEqual(createPoiCatalog("institution-1", landmark, [poi], contents).pois, []);
  assert.deepEqual(
    createPoiCatalog("institution-1", landmark, [poi], contents, { includeDrafts: true }).pois,
    [{ id: "poi-1", name: "Gallery", contentTypes: ["Information"] }],
  );
});
