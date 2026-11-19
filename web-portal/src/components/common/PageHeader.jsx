import React from "react";
import styles from "./PageHeader.module.css";

const PageHeader = ({ eyebrow, title, description, actions }) => (
  <header className={styles.pageHeader}>
    <div className={styles.content}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
);

export default PageHeader;
