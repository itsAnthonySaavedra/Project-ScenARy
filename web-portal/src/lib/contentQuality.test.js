import assert from "node:assert/strict";
import test from "node:test";
import {
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
