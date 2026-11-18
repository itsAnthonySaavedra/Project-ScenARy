import assert from "node:assert/strict";
import test from "node:test";
import { getContentAssignmentLimitError } from "./contentTypes.js";

const items = [
  { id: "landmark-info-1", type: "Information" },
  { id: "landmark-info-2", type: "Information" },
  { id: "landmark-quiz-1", type: "Quiz" },
  { id: "landmark-quiz-2", type: "Quiz" },
  { id: "landmark-model-1", type: "3D Model" },
  { id: "landmark-model-2", type: "VR Model" },
  { id: "poi-fact-1", type: "Fun Fact" },
  { id: "poi-fact-2", type: "Fun Fact" },
  { id: "poi-info-1", type: "Information" },
  { id: "poi-info-2", type: "Information" },
  { id: "poi-quiz-1", type: "Quiz" },
  { id: "poi-quiz-2", type: "Quiz" },
  { id: "poi-model", type: "VR Model" },
];

test("Landmarks allow one information item, quiz, and VR model per target", () => {
  assert.match(
    getContentAssignmentLimitError("Landmark", ["landmark-info-1", "landmark-info-2"], items),
    /one Information/,
  );
  assert.match(
    getContentAssignmentLimitError("Landmark", ["landmark-quiz-1", "landmark-quiz-2"], items),
    /one Quiz/,
  );
  assert.match(
    getContentAssignmentLimitError("Landmark", ["landmark-model-1", "landmark-model-2"], items),
    /one VR model/,
  );
  assert.equal(getContentAssignmentLimitError("Landmark", ["landmark-info-2"], items), "");
});

test("POIs allow one information item and quiz, unlimited facts, and no VR models", () => {
  assert.match(
    getContentAssignmentLimitError("POI", ["poi-info-1", "poi-info-2"], items),
    /one Information/,
  );
  assert.match(
    getContentAssignmentLimitError("POI", ["poi-quiz-1", "poi-quiz-2"], items),
    /one Quiz/,
  );
  assert.equal(
    getContentAssignmentLimitError("POI", ["poi-fact-1", "poi-fact-2"], items),
    "",
  );
  assert.match(
    getContentAssignmentLimitError("POI", ["poi-model"], items),
    /only be assigned to Landmarks/,
  );
});
