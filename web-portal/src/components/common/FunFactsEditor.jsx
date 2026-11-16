import React from "react";
import commonStyles from "./Common.module.css";

const FunFactsEditor = ({ facts, setFacts }) => {
  const updateFact = (index, value) =>
    setFacts((current) => current.map((fact, currentIndex) =>
      currentIndex === index ? value : fact,
    ));

  return (
    <div>
      <h4 style={{ color: "#C19A4B", marginBottom: "1rem" }}>Fun facts</h4>
      {facts.map((fact, index) => (
        <div key={index} style={{ marginBottom: "1rem" }}>
          <label htmlFor={`fun-fact-${index}`}>Fact {index + 1}</label>
          {facts.length > 1 && (
            <button
              type="button"
              onClick={() => setFacts((current) => current.filter((_, currentIndex) => currentIndex !== index))}
              style={{ marginLeft: 8 }}
            >
              Remove
            </button>
          )}
          <textarea
            id={`fun-fact-${index}`}
            className={commonStyles.formControl}
            rows={3}
            value={fact}
            onChange={(event) => updateFact(index, event.target.value)}
            required
          />
        </div>
      ))}
      <button type="button" onClick={() => setFacts((current) => [...current, ""])}>
        + Add fun fact
      </button>
    </div>
  );
};

export default FunFactsEditor;
