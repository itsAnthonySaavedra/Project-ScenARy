import React from "react";
import commonStyles from "./Common.module.css";

const QuizEditor = ({
  questions,
  setQuestions,
  shuffleQuestions,
  setShuffleQuestions,
  shuffleAnswers,
  setShuffleAnswers,
}) => {
  const updateQuestion = (index, updates) => {
    setQuestions((current) =>
      current.map((question, currentIndex) =>
        currentIndex === index ? { ...question, ...updates } : question,
      ),
    );
  };

  const addQuestion = () =>
    setQuestions((current) => [
      ...current,
      { question: "", questionType: "true-false", options: [], correctAnswer: "True" },
    ]);

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const changeQuestionType = (index, questionType) => {
    const question = questions[index];
    updateQuestion(index, {
      questionType,
      options: questionType === "multiple-choice"
        ? question.options?.length >= 2 ? question.options : ["", "", "", ""]
        : [],
      correctAnswer: questionType === "true-false" ? "True" : "",
    });
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const question = questions[questionIndex];
    const options = question.options.map((option, currentIndex) =>
      currentIndex === optionIndex ? value : option,
    );
    updateQuestion(questionIndex, {
      options,
      correctAnswer: question.correctAnswer === question.options[optionIndex]
        ? value
        : question.correctAnswer,
    });
  };

  const removeOption = (questionIndex, optionIndex) => {
    const question = questions[questionIndex];
    const removedOption = question.options[optionIndex];
    const options = question.options.filter((_, currentIndex) => currentIndex !== optionIndex);
    updateQuestion(questionIndex, {
      options,
      correctAnswer: question.correctAnswer === removedOption ? "" : question.correctAnswer,
    });
  };

  return (
    <div>
      <h4 style={{ color: "#C19A4B", marginBottom: "1rem" }}>Quiz questions</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        <label style={{ color: "#ccc" }}>
          <input
            type="checkbox"
            checked={shuffleQuestions}
            onChange={(event) => setShuffleQuestions(event.target.checked)}
          />{" "}
          Shuffle question order
        </label>
        <label style={{ color: "#ccc" }}>
          <input
            type="checkbox"
            checked={shuffleAnswers}
            onChange={(event) => setShuffleAnswers(event.target.checked)}
          />{" "}
          Shuffle multiple-choice answers
        </label>
      </div>
      {questions.map((question, questionIndex) => (
        <div
          key={questionIndex}
          style={{ borderBottom: "1px solid #333", paddingBottom: 15, marginBottom: 15 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", color: "#aaa" }}>
              Question {questionIndex + 1}
            </label>
            {questions.length > 1 && (
              <button type="button" onClick={() => removeQuestion(questionIndex)}>
                Remove question
              </button>
            )}
          </div>
          <select
            className={commonStyles.formControl}
            aria-label={`Question ${questionIndex + 1} type`}
            value={question.questionType || "true-false"}
            onChange={(event) => changeQuestionType(questionIndex, event.target.value)}
            style={{ margin: "8px 0" }}
          >
            <option value="true-false">True / False</option>
            <option value="multiple-choice">Multiple choice</option>
          </select>
          <textarea
            className={commonStyles.formControl}
            rows={2}
            placeholder="Enter the question..."
            aria-label={`Question ${questionIndex + 1} text`}
            value={question.question}
            onChange={(event) => updateQuestion(questionIndex, { question: event.target.value })}
            required
          />
          {question.questionType === "multiple-choice" ? (
            <div style={{ marginTop: 10 }}>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className={commonStyles.formControl}
                    aria-label={`Question ${questionIndex + 1} choice ${optionIndex + 1}`}
                    placeholder={`Choice ${optionIndex + 1}`}
                    value={option}
                    onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                    required
                  />
                  {question.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(questionIndex, optionIndex)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateQuestion(questionIndex, { options: [...question.options, ""] })}
              >
                + Add choice
              </button>
              <label style={{ display: "block", marginTop: 10 }}>
                Correct answer
                <select
                  className={commonStyles.formControl}
                  aria-label={`Question ${questionIndex + 1} correct answer`}
                  value={question.options.indexOf(question.correctAnswer) < 0
                    ? ""
                    : String(question.options.indexOf(question.correctAnswer))}
                  onChange={(event) => updateQuestion(questionIndex, {
                    correctAnswer: question.options[Number(event.target.value)],
                  })}
                  required
                >
                  <option value="">Select the correct choice</option>
                  {question.options.map((option, optionIndex) => (
                    <option key={optionIndex} value={optionIndex} disabled={!option.trim()}>
                      {option.trim() || `Choice ${optionIndex + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label style={{ display: "block", marginTop: 10 }}>
              Correct answer
              <select
                className={commonStyles.formControl}
                value={question.correctAnswer || "True"}
                onChange={(event) => updateQuestion(questionIndex, { correctAnswer: event.target.value })}
              >
                <option value="True">True</option>
                <option value="False">False</option>
              </select>
            </label>
          )}
        </div>
      ))}
      <button type="button" onClick={addQuestion}>+ Add question</button>
    </div>
  );
};

export default QuizEditor;
