import { getContentScope } from "./contentScope.js";
import {
  MODEL_CONTENT_TYPE,
  normalizeContentType,
} from "./contentTypes.js";

export const getContentQualityIssues = (item) => {
  const issues = [];
  const title = typeof item?.title === "string" ? item.title.trim() : "";
  const data = item?.data && typeof item.data === "object" ? item.data : {};

  if (!title) issues.push("Add a title");
  if (!item?.type) issues.push("Select a content type");
  if (!item?.scope) issues.push("Select a content area");

  if (
    item?.type === "Information" &&
    !(typeof data.description === "string" && data.description.trim())
  ) {
    issues.push("Add a description");
  }
  if (
    item?.type === "Fun Fact" &&
    !(
      (Array.isArray(data.facts) && data.facts.some((fact) => typeof fact === "string" && fact.trim())) ||
      (typeof data.fact === "string" && data.fact.trim())
    )
  ) {
    issues.push("Add a fun fact");
  }
  if (
    item?.type === "Fun Fact" &&
    Array.isArray(data.facts) &&
    data.facts.some((fact) => !(typeof fact === "string" && fact.trim()))
  ) {
    issues.push("Complete every fun fact");
  }
  if (
    normalizeContentType(item?.type) === MODEL_CONTENT_TYPE &&
    ![data.modelUrl, data.modelPath].some(
      (value) => typeof value === "string" && value.trim(),
    )
  ) {
    issues.push("Add a model URL");
  }
  if (
    item?.type === "Quiz" &&
    (!Array.isArray(data.quizzes) || data.quizzes.length === 0)
  ) {
    issues.push("Add at least one quiz question");
  }
  if (
    item?.type === "Quiz" &&
    Array.isArray(data.quizzes) &&
    data.quizzes.some(
      (quiz) =>
        !quiz ||
        !(typeof quiz.question === "string" && quiz.question.trim()) ||
        (quiz.questionType === "multiple-choice" &&
          (!Array.isArray(quiz.options) ||
            quiz.options.length < 2 ||
            quiz.options.some((option) => !(typeof option === "string" && option.trim())) ||
            !quiz.options.includes(quiz.correctAnswer))) ||
        ((quiz.questionType || "true-false") === "true-false" &&
          !["True", "False"].includes(quiz.correctAnswer || "")),
    )
  ) {
    issues.push("Complete every quiz question");
  }
  return issues;
};

export const isContentReady = (item) =>
  !item?.needsAttention && getContentQualityIssues(item).length === 0;

export const isReadyARContent = (item) =>
  ["Information", "Fun Fact", "Quiz"].includes(normalizeContentType(item?.type)) && isContentReady(item);

export const evaluatePoiReadiness = (contentIds = [], contents = [], isAvailable = () => true) => {
  const assignedItems = (Array.isArray(contentIds) ? contentIds : [])
    .map((id) => contents.find((item) => item.id === id))
    .filter((item) => item && getContentScope(item) === "POI");

  const readyItems = [];
  const notReadyItems = [];
  for (const item of assignedItems) {
    (isContentReady(item) && isAvailable(item) ? readyItems : notReadyItems).push(item);
  }
  const types = new Set(readyItems.map((item) => normalizeContentType(item.type)));

  const missingTypes = ["Information", "Quiz", "Fun Fact"].filter((type) => !types.has(type));
  const reasons = [];
  if (missingTypes.length > 0) {
    reasons.push(`missing POI-area content: ${missingTypes.join(", ")}`);
  }
  if (notReadyItems.length > 0) {
    reasons.push(
      `content needing attention: ${notReadyItems.map((i) => i.title || i.type).join(", ")}`,
    );
  }

  return { canPublish: reasons.length === 0, missingTypes, notReadyItems, reasons };
};

export const hasValidCoords = (item) => Number.isFinite(item?.lat) && Number.isFinite(item?.lng);

export const isPoiPublished = (poi) => poi?.status === "Published" || poi?.isPublished === true;

export function evaluateLandmarkReadiness(landmark, {
  contents = [], pois = [], overrideLandmarkContentIds, overrideName, overrideDescription, overrideCoords,
} = {}) {
  const name = overrideName ?? landmark?.landmarkName ?? landmark?.institutionName;
  const description = overrideDescription ?? landmark?.info?.description ?? landmark?.description;
  const hasInfo = typeof name === "string" && Boolean(name.trim()) &&
    typeof description === "string" && Boolean(description.trim()) &&
    hasValidCoords(overrideCoords ?? landmark);

  const assignedIds = overrideLandmarkContentIds ?? landmark?.contentIds;
  const ids = new Set(Array.isArray(assignedIds) ? assignedIds : []);
  const types = new Set();
  if (landmark) {
    for (const item of contents) {
      if (getContentScope(item) !== "Landmark" ||
        !(ids.has(item.id) || item.targetId === landmark.id) || !isContentReady(item)) continue;
      const type = normalizeContentType(item.type);
      if (type !== MODEL_CONTENT_TYPE || item.status === "Published") types.add(type);
    }
  }

  const hasLandmarkInformation = types.has("Information");
  const hasLandmarkQuiz = types.has("Quiz");
  const hasLandmarkFunFact = types.has("Fun Fact");
  const hasLandmarkVR = types.has(MODEL_CONTENT_TYPE);
  const hasCompletePoi = Boolean(landmark) && pois.some((poi) =>
    poi.landmarkId === landmark.id && isPoiPublished(poi) && evaluatePoiReadiness(poi.contentIds, contents).canPublish,
  );
  const missingTypes = ["Information", "Quiz", "Fun Fact", MODEL_CONTENT_TYPE].filter((type) => !types.has(type));
  const missing = [];
  if (!hasInfo) missing.push("landmark name, description, and coordinates");
  if (missingTypes.length) missing.push(`Landmark area missing: ${missingTypes.join(", ")}`);
  if (!hasCompletePoi) missing.push("POI area needs at least one published POI with Information, Quiz, and Fun Fact");

  return {
    canPublish: missing.length === 0, hasInfo, hasLandmarkInformation, hasLandmarkQuiz,
    hasLandmarkFunFact, hasLandmarkVR, hasCompletePoi, missing,
  };
}

export const hasPublishedInstitutionARContent = (items = []) =>
  items.some((item) => item.status === "Published" && isReadyARContent(item));

export const hasPublishedLandmarkARContent = (landmark, items = []) => {
  const contentIds = new Set(
    Array.isArray(landmark?.contentIds) ? landmark.contentIds : [],
  );
  return items.some(
    (item) =>
      contentIds.has(item.id) &&
      item.status === "Published" &&
      isReadyARContent(item),
  );
};

export const hasReadyLandmarkARContent = (landmark, items = []) => {
  const contentIds = new Set(
    Array.isArray(landmark?.contentIds) ? landmark.contentIds : [],
  );
  return items.some(
    (item) =>
      contentIds.has(item.id) &&
      ["Awaiting Content", "Published"].includes(item.status) &&
      isReadyARContent(item),
  );
};

export const getInstitutionContentReadiness = (items = []) => {
  const publishedReadyItems = items.filter(
    (item) => item.status === "Published" && isContentReady(item),
  );
  const hasInformation = publishedReadyItems.some(
    (item) => normalizeContentType(item.type) === "Information",
  );
  const hasModel = publishedReadyItems.some(
    (item) => normalizeContentType(item.type) === MODEL_CONTENT_TYPE,
  );
  const missing = [];

  if (!hasInformation) missing.push("one Published Information item");
  if (!hasModel) missing.push("one Published VR model");

  return { isReady: missing.length === 0, missing };
};
