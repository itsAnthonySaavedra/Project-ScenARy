import React, { useState } from "react";
import styles from "../components/common/Common.module.css";

const COLLAB_EMAIL = "scenaryqa@gmail.com"; // Replace with your team's email

export default function CollabPage() {
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [copied, setCopied] = useState("");
  const [proposal, setProposal] = useState({
    name: "",
    organization: "",
    track: "Historical / Cultural & Educational Site",
    siteOrProject: "",
    timeline: "",
    details: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProposal((prev) => ({ ...prev, [name]: value }));
  };

  const scrollToProposal = () => {
    setShowContactInfo(true);
    setTimeout(() => {
      document.getElementById("propose-form")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const subjectText = `ScenARy Collaboration Proposal - ${
    proposal.siteOrProject.trim() || proposal.track
  }`;

  const bodyText = [
    `Name: ${proposal.name.trim() || "[Your Name]"}`,
    `Organization / Title: ${proposal.organization.trim() || "[Organization / Title]"}`,
    `Collaboration Track: ${proposal.track}`,
    `Site / Landmark / Project: ${proposal.siteOrProject.trim() || "[Site or Project Name]"}`,
    `Preferred Timeline: ${proposal.timeline.trim() || "[Target Timeline]"}`,
    "",
    "Message / AR Goals:",
    proposal.details.trim() || "[Describe your collaboration idea, site details, or 3D/AR needs]",
  ].join("\n");

  const mailtoLink = `mailto:${COLLAB_EMAIL}?subject=${encodeURIComponent(
    subjectText
  )}&body=${encodeURIComponent(bodyText)}`;

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "0.65rem",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    fontSize: "0.9rem",
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "4rem 2rem" }}>
      {/* --- HERO / INTRO SECTION --- */}
      <section style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto 4rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2.8rem",
            color: "#fff",
            marginBottom: "1rem",
          }}
        >
          Partner with <span style={{ color: "var(--color-accent-gold)" }}>ScenARy</span>
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "1.1rem",
            lineHeight: "1.6",
            marginBottom: "2rem",
          }}
        >
          We collaborate with creators, venues, and organizations to bring spaces to life through high-fidelity Augmented Reality.
        </p>
        <button
          type="button"
          onClick={scrollToProposal}
          className={styles.btnPrimary}
          style={{ textDecoration: "none", cursor: "pointer", border: "none" }}
        >
          Propose a Collaboration
        </button>
      </section>

      {/* --- BENEFITS CARDS (Using .contentCard) --- */}
      <section
        style={{
          maxWidth: "1000px",
          margin: "0 auto 5rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {/* Benefit 1 */}
        <div className={styles.contentCard}>
          <div className={styles.contentImage}>
            <div className={styles.contentTitleOverlay}>
              <h3>Digital Preservation</h3>
              <p>3D Spatial Scanning &amp; Anchoring</p>
            </div>
          </div>
          <div className={styles.contentDetails}>
            <p className={styles.contentDescription}>
              Convert historical sites, ruins, and artifacts into permanent, highly accurate 3D spatial models. Preserve fragile heritage in an immersive digital format accessible anywhere in the world.
            </p>
          </div>
        </div>

        {/* Benefit 2 */}
        <div className={styles.contentCard}>
          <div className={styles.contentImage}>
            <div className={styles.contentTitleOverlay}>
              <h3>Educational Immersion</h3>
              <p>Interactive Curriculum &amp; Tours</p>
            </div>
          </div>
          <div className={styles.contentDetails}>
            <p className={styles.contentDescription}>
              Empower students, researchers, and visitors to interactively explore contexts on-site or remotely. Embed rich metadata, timeline triggers, and audio narratives directly into the AR space.
            </p>
          </div>
        </div>
      </section>

      {/* --- COLLABORATION PROCESS (Workflow Steps) --- */}
      <section style={{ maxWidth: "1000px", margin: "0 auto 5rem", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-accent-gold)",
            marginBottom: "3rem",
          }}
        >
          How Collaboration Works
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "2rem",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1.5rem",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-accent-gold)" }}>
              01
            </span>
            <h4 style={{ margin: "1rem 0 0.5rem", color: "#fff" }}>Proposal</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Submit site details, photos, or spatial scan data.
            </p>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1.5rem",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-accent-gold)" }}>
              02
            </span>
            <h4 style={{ margin: "1rem 0 0.5rem", color: "#fff" }}>Co-Creation</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Our spatial engine maps anchors and renders interactive scenes.
            </p>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1.5rem",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-accent-gold)" }}>
              03
            </span>
            <h4 style={{ margin: "1rem 0 0.5rem", color: "#fff" }}>Testing &amp; Review</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Inspect and refine the experience in-situ with preview keys.
            </p>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1.5rem",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-accent-gold)" }}>
              04
            </span>
            <h4 style={{ margin: "1rem 0 0.5rem", color: "#fff" }}>Public Launch</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Publish live for visitors, students, and global explorers.
            </p>
          </div>
        </div>
      </section>

      {/* --- CONTACT & PROPOSAL SECTION --- */}
      <section id="propose-form" className={styles.settingsContainer}>
        <div
          className={styles.modalContent}
          style={{
            maxWidth: "680px",
            background: "rgba(0,0,0,0.85)",
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <div className={styles.modalHeader}>
            <h3>Collaboration Email Builder</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
              Fill out your details to generate a pre-addressed email with a subject line and summary, or copy the email/draft directly.
            </p>
          </div>

          {!showContactInfo ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <button
                type="button"
                onClick={() => setShowContactInfo(true)}
                className={styles.btnPrimary}
              >
                Reveal Contact &amp; Email Builder
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "1rem 1.2rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <p style={{ color: "var(--color-accent-gold)", fontWeight: "bold", marginBottom: "0.2rem", fontSize: "0.85rem" }}>
                    To:
                  </p>
                  <p style={{ color: "#fff", fontSize: "1rem", margin: 0 }}>{COLLAB_EMAIL}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(COLLAB_EMAIL, "email")}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-accent-gold)",
                    background: "transparent",
                    color: "var(--color-accent-gold)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  {copied === "email" ? "Copied Email" : "Copy Email"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={proposal.name}
                    onChange={handleChange}
                    placeholder="Full name"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                    Organization / Title
                  </label>
                  <input
                    type="text"
                    name="organization"
                    value={proposal.organization}
                    onChange={handleChange}
                    placeholder="Institution, museum, or studio"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                    Collaboration Type
                  </label>
                  <select
                    name="track"
                    value={proposal.track}
                    onChange={handleChange}
                    style={{ ...inputStyle, background: "#141414" }}
                  >
                    <option value="Historical / Cultural & Educational Site">
                      Historical / Cultural &amp; Educational Site
                    </option>
                    <option value="3D Modeling / Spatial Scanning">
                      3D Modeling / Spatial Scanning
                    </option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                    Site / Landmark / Project
                  </label>
                  <input
                    type="text"
                    name="siteOrProject"
                    value={proposal.siteOrProject}
                    onChange={handleChange}
                    placeholder="e.g., Landmark or project name"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                  Preferred Timeline
                </label>
                <input
                  type="text"
                  name="timeline"
                  value={proposal.timeline}
                  onChange={handleChange}
                  placeholder="e.g., Q1 2027 or flexible"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                  AR Goals &amp; Details
                </label>
                <textarea
                  name="details"
                  rows={4}
                  value={proposal.details}
                  onChange={handleChange}
                  placeholder="Share what site or assets you have, your goals, and any questions..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "0.9rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p style={{ color: "var(--color-accent-gold)", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                  Subject Header Preview:
                </p>
                <p style={{ color: "#fff", fontSize: "0.9rem", margin: 0, wordBreak: "break-word" }}>
                  {subjectText}
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.25rem" }}>
                <a
                  href={mailtoLink}
                  className={styles.btnPrimary}
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  Open in Email App
                </a>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(`To: ${COLLAB_EMAIL}\nSubject: ${subjectText}\n\n${bodyText}`, "draft")
                  }
                  style={{
                    padding: "0.8rem 1.25rem",
                    borderRadius: "4px",
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  {copied === "draft" ? "Copied Full Email Draft" : "Copy Subject & Body"}
                </button>
              </div>

              <p style={{ color: "var(--color-text-muted)", fontSize: "0.78rem", margin: "0.25rem 0 0" }}>
                Note: Very long `mailto:` links can be clipped by some mail clients—if you write a long message, use <strong>Copy Subject &amp; Body</strong> and paste it into your email.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}