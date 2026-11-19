import React from 'react';
import styles from './Layout.module.css';

const Header = () => (
    <div className={styles.dashboardHeader}>
        <div className={styles.headerLogo} style={{ color: '#C19A4B' }} aria-label="ScenARy portal">
            <i className="fa-solid fa-landmark" aria-hidden="true"></i>
            <span style={{ fontWeight: 700, letterSpacing: '1px' }}>ScenARy</span>
        </div>
    </div>
);

export default Header;
