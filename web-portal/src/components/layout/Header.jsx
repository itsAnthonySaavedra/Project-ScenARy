import React from 'react';
import PropTypes from 'prop-types';
import styles from './Layout.module.css';

const Header = ({ title }) => {
    return (
        <div className={styles.dashboardHeader}>
            <h2>{title}</h2>
            <div className={styles.headerLogo} style={{ color: '#C19A4B' }}>
                <i className="fa-solid fa-landmark"></i>
                <span style={{ fontWeight: 700, letterSpacing: '1px' }}>ScenARy</span>
            </div>
        </div>
    );
};

Header.propTypes = {
    title: PropTypes.string.isRequired,
};

export default Header;
