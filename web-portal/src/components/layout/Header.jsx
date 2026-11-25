import React from 'react';
import styles from './Layout.module.css';

const Header = () => (
    <div className={styles.dashboardHeader}>
        <div className={styles.headerLogo}>
            <img className={styles.headerMark} src="/assets/images/scenary-mark.png" alt="" width="36" height="36" />
            <span>ScenARy</span>
        </div>
    </div>
);

export default Header;
