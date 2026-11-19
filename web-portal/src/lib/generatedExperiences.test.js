import assert from "node:assert/strict";
import test from "node:test";
import { buildGeneratedExperiences } from "./generatedExperiences.js";

const landmark = {
  id: "landmark-1",
  landmarkName: "Historic site",
  contentIds: ["ar-1", "vr-1"],
};
const arContent = {
  id: "ar-1",
  title: "Site information",
  type: "Information",
  scope: "Landmark",
  status: "Published",
  data: { description: "A historical overview." },
};
const vrContent = {
  id: "vr-1",
  title: "Site model",
  type: "VR Model",
  scope: "Landmark",
  status: "Published",
  data: { modelUrl: "https://example.test/model.glb" },
};

test("hides published content until the landmark has both AR and VR", () => {
  const arOnly = buildGeneratedExperiences([landmark], [], [arContent])[0];
  assert.equal(arOnly.isReleased, false);
  assert.deepEqual(arOnly.contentItems, []);

  const pair = buildGeneratedExperiences([landmark], [], [arContent, vrContent])[0];
  assert.equal(pair.isReleased, true);
  assert.deepEqual(pair.contentItems.map((item) => item.id), ["ar-1", "vr-1"]);
});

test("does not release incomplete published VR models", () => {
  const incompleteVr = { ...vrContent, data: {} };
  const experience = buildGeneratedExperiences(
    [landmark],
    [],
    [arContent, incompleteVr],
  )[0];
  assert.equal(experience.isReleased, false);
  assert.deepEqual(experience.contentItems, []);
});
