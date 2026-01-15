import React from 'react';
import styles from '../components/common/Common.module.css';

const Settings = () => {
    return (
        <div className={styles.settingsContainer}>
            <div className={`${styles.settingsCard} ${styles.profileCard}`} style={{ height: 'auto', flexDirection: 'column', padding: '3rem', gap: '1.5rem' }}>
                <div className={styles.profileIconLarge}>
                    <i className="fa-solid fa-user-shield"></i>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <h2>Super Admin</h2>
                    <p style={{ color: '#a8a29e' }}>admin@scenary.com</p>
                </div>

                <div style={{ width: '100%', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className={styles.formGroup}>
                        <label>Display Name</label>
                        <input type="text" className={styles.formControl} defaultValue="Super Admin" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Email Address</label>
                        <input type="email" className={styles.formControl} defaultValue="admin@scenary.com" />
                    </div>
                    <button className={styles.btnPrimary} style={{ alignSelf: 'flex-end', marginTop: '1rem' }}>
                        Save Changes
                    </button>
                </div>
            </div>

            <div className={styles.settingsCard} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1.5rem' }}>
                <h3>System Preferences</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                    <div>
                        <h4 style={{ color: '#fff', fontSize: '1rem' }}>Maintenance Mode</h4>
                        <p style={{ color: '#a8a29e', fontSize: '0.8rem' }}>Disable access for all non-admin users</p>
                    </div>
                    <div className={styles.toggleSwitch}>
                        <input type="checkbox" id="sys-maintenance" />
                        <label htmlFor="sys-maintenance"></label>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ color: '#fff', fontSize: '1rem' }}>Email Notifications</h4>
                        <p style={{ color: '#a8a29e', fontSize: '0.8rem' }}>Receive reports and alerts via email</p>
                    </div>
                    <div className={styles.toggleSwitch}>
                        <input type="checkbox" id="sys-notifications" defaultChecked />
                        <label htmlFor="sys-notifications"></label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
