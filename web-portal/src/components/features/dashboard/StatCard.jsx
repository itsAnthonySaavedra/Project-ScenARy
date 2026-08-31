import React from "react";
import PropTypes from "prop-types";
import styles from "./Dashboard.module.css";

const StatCard = ({ icon, title, value }) => {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>
        <i className={icon}></i>
      </div>
      <div className={styles.statInfo}>
        <h3>{title}</h3>
        <div className={styles.value}>{value}</div>
      </div>
    </div>
  );
};

StatCard.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default StatCard;
