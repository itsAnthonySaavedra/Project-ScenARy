import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Login.module.css';

const Login = () => {
    const { login } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const loginType = searchParams.get('type') || 'institute';
    const isAdmin = loginType === 'admin';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();

        if (isAdmin && !email.includes('admin')) {
            setError('Access Denied: You must use an Administrator account.');
            return;
        }

        if (!isAdmin && email.includes('admin')) {
            setError('Access Denied: Please use the Admin Portal for administrator accounts.');
            return;
        }

        const result = login(email, password);
        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div className={styles.authContainer}>
            <button className={styles.btnBack} onClick={() => navigate('/')}>
                <i className="fa-solid fa-arrow-left"></i> Back to Home
            </button>
            <div className={styles.authWrapper}>
                <div className={styles.glassCard}>
                    <div className={styles.logoArea}>
                        <i className={`fa-solid fa-landmark ${styles.logoIcon}`}></i>
                        <h3>ScenARy V2</h3>
                        <p>{isAdmin ? 'Administrator Portal' : 'Institution Portal'}</p>
                    </div>
                    {error && (
                        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label>Email</label>
                            <input
                                type="email"
                                className={styles.formControl}
                                placeholder={isAdmin ? "admin@scenary.com" : "contact@institute.com"}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Password</label>
                            <input
                                type="password"
                                className={styles.formControl}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className={styles.btnPrimary}>
                            Login as {isAdmin ? 'Admin' : 'Institute'}
                        </button>
                    </form>
                    <div className={styles.authFooter}>
                        <p style={{ fontSize: '0.8rem' }}>
                            {isAdmin
                                ? 'Restricted area for ScenARy administrators only.'
                                : 'Not a partner yet? Contact our sales team.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
