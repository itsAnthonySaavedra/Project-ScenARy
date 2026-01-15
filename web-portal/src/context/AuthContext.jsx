import React, { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Mock user state. In real app, check localStorage or API.
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    const login = (email, password) => {
        // Mock authentication logic
        if (email.includes('admin')) {
            const adminUser = { name: 'Super Admin', role: 'admin', email };
            setUser(adminUser);
            navigate('/admin/dashboard');
            return { success: true };
        }

        if (email.includes('fort') || email.includes('user')) {
            const instituteUser = { name: 'Fort San Pedro', role: 'institute', email };
            setUser(instituteUser);
            navigate('/institute/dashboard');
            return { success: true };
        }

        return { success: false, message: 'Invalid credentials. Try "admin@" or "fort@"' };
    };

    const logout = () => {
        setUser(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
