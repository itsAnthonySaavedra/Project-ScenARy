import React from 'react';
import PropTypes from 'prop-types';
import styles from './Dashboard.module.css';

const HistoryItem = ({ icon, title, time }) => {
    return (
        <div className={styles.historyItem}>
            <div className={styles.historyIconSmall}>
                <i className={icon}></i>
            </div>
            <div className={styles.historyContent}>
                <h4>{title}</h4>
                <p>{time}</p>
            </div>
        </div>
    );
};

HistoryItem.propTypes = {
    icon: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
};

export default HistoryItem;
