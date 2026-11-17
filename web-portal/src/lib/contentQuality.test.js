import assert from "node:assert/strict";
import test from "node:test";
import { hasPublishedInstitutionARContent } from "./contentQuality.js";

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
