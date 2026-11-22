import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AdminActivityFeed from './AdminActivityFeed';
import PropTypes from 'prop-types';
import styles from './Layout.module.css';

const Layout = ({ role }) => {

    return (
        <div className={styles.dashboardContainer}>
            <Sidebar role={role} />
            <main className={styles.mainContent}>
                <Header />
                {role === 'admin' && <AdminActivityFeed />}
                <Outlet />
            </main>
        </div>
    );
};

Layout.propTypes = {
    role: PropTypes.oneOf(['admin', 'institution', '3d-modeler']).isRequired,
};

export default Layout;
