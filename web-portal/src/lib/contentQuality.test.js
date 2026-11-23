import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePoiReadiness,
  hasPublishedInstitutionARContent,
  hasPublishedLandmarkARContent,
  hasReadyLandmarkARContent,
} from "./contentQuality.js";

const readyInformation = {
  title: "Gallery information",
  type: "Information",
  scope: "Landmark",
  status: "Published",
  data: { description: "A detailed introduction to the gallery." },
};

test("requires complete POI-area Information, Quiz, and Fun Fact before release", () => {
  const items = [
    { ...readyInformation, id: "info", scope: "POI", status: "Awaiting Content" },
    { id: "quiz", title: "Quiz", scope: "POI", type: "Quiz", status: "Awaiting Content",
      data: { quizzes: [{ question: "Is this a fort?", correctAnswer: "True" }] } },
    { id: "fact", title: "Fact", scope: "POI", type: "Fun Fact", status: "Awaiting Content",
      data: { facts: ["This site had a fort."] } },
  ];
  const ids = items.map(({ id }) => id);
  assert.equal(evaluatePoiReadiness(ids, items).canPublish, true);
  assert.deepEqual(evaluatePoiReadiness(ids, items.slice(0, 1)).missingTypes, ["Quiz", "Fun Fact"]);
  assert.deepEqual(evaluatePoiReadiness(ids, [items[0], items[1], { ...items[2], scope: "Landmark" }]).missingTypes, ["Fun Fact"]);
  assert.equal(evaluatePoiReadiness(ids, [items[0], items[1], { ...items[2], needsAttention: true }]).canPublish, false);
});

test("requires complete published AR content, not a model or draft", () => {
  assert.equal(hasPublishedInstitutionARContent([]), false);
  assert.equal(
    hasPublishedInstitutionARContent([
      { ...readyInformation, status: "Awaiting Content" },
    ]),
    false,
  );
  assert.equal(
    hasPublishedInstitutionARContent([
      { ...readyInformation, data: { description: " " } },
    ]),
    false,
  );
  assert.equal(
    hasPublishedInstitutionARContent([
      { ...readyInformation, type: "VR Model" },
    ]),
    false,
  );
  assert.equal(hasPublishedInstitutionARContent([readyInformation]), true);
});

test("requires published AR content to be assigned to the landmark", () => {
  const landmark = { id: "landmark-1", contentIds: ["ar-1"] };
  assert.equal(hasPublishedLandmarkARContent(landmark, [readyInformation]), false);
  assert.equal(
    hasPublishedLandmarkARContent(landmark, [{ ...readyInformation, id: "ar-1" }]),
    true,
  );
  assert.equal(
    hasPublishedLandmarkARContent(
      { ...landmark, contentIds: [] },
      [{ ...readyInformation, id: "ar-1" }],
    ),
    false,
  );
});

test("allows a complete AR draft to be used as a model reference before paired release", () => {
  const landmark = { id: "landmark-1", contentIds: ["ar-1"] };
  assert.equal(
    hasReadyLandmarkARContent(
      landmark,
      [{ ...readyInformation, id: "ar-1", status: "Awaiting Content" }],
    ),
    true,
  );
  assert.equal(
    hasReadyLandmarkARContent(
      landmark,
      [{ ...readyInformation, id: "ar-1", status: "Rejected" }],
    ),
    false,
  );
});
