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

export const hasPublishedInstitutionARContent = (items = []) =>
  items.some(
    (item) =>
      item.status === "Published" &&
      ["Information", "Fun Fact", "Quiz"].includes(normalizeContentType(item.type)) &&
      isContentReady(item),
  );

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