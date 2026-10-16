import { MODEL_CONTENT_TYPE, normalizeContentType } from "./contentTypes";

export const getContentQualityIssues = (item) => {
  const issues = [];
  const title = item.title?.trim();
  const data = item.data || {};

  if (!title) issues.push("Add a title");
  if (!item.type) issues.push("Select a content type");
  if (!item.scope) issues.push("Select a content area");

  if (item.type === "Information" && !data.description?.trim()) {
    issues.push("Add a description");
  }
  if (item.type === "Fun Fact" && !data.fact?.trim()) {
    issues.push("Add a fun fact");
  }
  if (
    normalizeContentType(item.type) === MODEL_CONTENT_TYPE &&
    !(data.modelUrl || data.modelPath)?.trim()
  ) {
    issues.push("Add a model URL");
  }
  if (item.type === "Quiz" && (!data.quizzes || data.quizzes.length === 0)) {
    issues.push("Add at least one quiz question");
  }
  if (
    item.type === "Quiz" &&
    data.quizzes?.some((quiz) => !quiz.question?.trim())
  ) {
    issues.push("Complete every quiz question");
  }
  return issues;
};

export const isContentReady = (item) =>
  !item.needsAttention && getContentQualityIssues(item).length === 0;