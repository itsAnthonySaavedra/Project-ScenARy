export const createDefaultQuizQuestion = () => ({
  question: "",
  questionType: "true-false",
  options: [],
  correctAnswer: "True",
});

export const normalizeQuizQuestions = (quizzes) =>
  Array.isArray(quizzes) && quizzes.length
    ? quizzes.map((quiz) => {
        const questionType =
          quiz.questionType ||
          (Array.isArray(quiz.options) ? "multiple-choice" : "true-false");
        return {
          question: quiz.question || "",
          questionType,
          options: questionType === "multiple-choice"
            ? (Array.isArray(quiz.options) && quiz.options.length >= 2
              ? quiz.options
              : ["", "", "", ""])
            : [],
          correctAnswer: quiz.correctAnswer || quiz.answer || (questionType === "true-false" ? "True" : ""),
        };
      })
    : [createDefaultQuizQuestion()];

export const normalizeFunFacts = (data) =>
  Array.isArray(data?.facts) && data.facts.length
    ? data.facts.map((fact) => typeof fact === "string" ? fact : "")
    : [typeof data?.fact === "string" ? data.fact : ""];

export function buildModelEditPatch(model, previous, deleteValue) {
  const patch = Object.fromEntries(Object.entries(model).map(([field, value]) => [`data.${field}`, value]));
  const obsoleteFields = [
    "spawnPoint", "position", "rotation", "surfaceNormal",
    "spawnX", "spawnY", "spawnZ", "SpawnZ", "spawnRotationY", "spawnRotationalY", "spawnSurfaceNormal", "spawnCoordinateSpace",
  ];
  if (model.modelUrl !== (previous.modelUrl || previous.modelPath)) {
    obsoleteFields.push("modelPath", "modelFileName", "modelFileType", "modelStoragePath");
  }
  for (const field of obsoleteFields) {
    if (Object.hasOwn(previous, field) && !Object.hasOwn(model, field)) patch[`data.${field}`] = deleteValue;
  }
  return patch;
}
