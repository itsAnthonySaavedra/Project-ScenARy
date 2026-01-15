import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PropTypes from 'prop-types';
import styles from './Layout.module.css';

const Layout = ({ role }) => {
    const location = useLocation();

    // Simple implementation to derive title from path, or can be passed via outlet context?
    // For now, let's map path to title for better UX.
    const getTitle = (pathname) => {
        if (pathname.includes('/dashboard')) return role === 'admin' ? 'Admin Dashboard' : 'Dashboard';
        if (pathname.includes('/users')) return 'User Management';
        if (pathname.includes('/institutions')) return 'Institutions';
        if (pathname.includes('/content')) return 'Content Management';
        if (pathname.includes('/analytics')) return 'Analytics';
        if (pathname.includes('/settings')) return 'Settings';
        if (pathname.includes('/tours')) return 'My Tours';
        if (pathname.includes('/profile')) return 'Profile';
        return 'Dashboard';
    };

    const title = getTitle(location.pathname);

    return (
        <div className={styles.dashboardContainer}>
            <Sidebar role={role} />
            <main className={styles.mainContent}>
                <Header title={title} />
                <Outlet />
            </main>
        </div>
    );
};

Layout.propTypes = {
    role: PropTypes.oneOf(['admin', 'institute']).isRequired,
};

export default Layout;
