import React from "react";
import { Link } from "react-router-dom";
import styles from "./Landing.module.css";

const Landing = () => {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav className={styles.mainNav}>
        <div className={styles.navLogo}>
          <i
            className="fa-solid fa-landmark"
            style={{ color: "var(--color-accent-gold)", marginRight: "0.5rem" }}
          ></i>{" "}
          ScenARy
        </div>
        <div className="nav-links">
          <Link to="/login?type=institution" className={styles.btnOutline}>
            Institute Login
          </Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Bringing History to Life <br /> <span>Together</span>
          </h1>
          <p className={styles.heroText}>
            Experience the past like never before with our augmented reality
            platform. Build, explore, and learn from historical sites in
            immersive detail.
          </p>
          <Link to="/login?type=institution" className={styles.btnPrimary}>
            Start Building
          </Link>
        </div>
      </header>

      <footer className={styles.mainFooter} style={{ marginTop: "auto" }}>
        <div className={styles.footerContent}>
          <div className={styles.footerInfo}>
            <div
              className={styles.logo}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <i
                className="fa-solid fa-landmark"
                style={{ color: "var(--color-accent-gold)" }}
              ></i>{" "}
              ScenARy
            </div>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--color-text-muted)",
                maxWidth: "300px",
              }}
            >
              An Augmented Reality replica model of historical sites. Contact us
              for more information.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">Collab</a>
            <a href="#">Create for Institute</a>
            <Link to="/login?type=admin">Admin</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          &copy; 2025 ScenARy, Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
