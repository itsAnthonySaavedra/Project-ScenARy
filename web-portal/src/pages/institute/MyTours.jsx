import React from 'react';
import commonStyles from '../../components/common/Common.module.css';

const InstituteTours = () => {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
                <button className={`${commonStyles.btnPrimary} btn-add`}>
                    <i className="fa-solid fa-plus"></i> Create New Tour
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                <div className={commonStyles.contentCard} style={{ height: 'auto', flexDirection: 'column' }}>
                    <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                        <img src="/assets/images/fort_san_pedro.png" alt="Tour" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#4ade80', color: '#000', padding: '0.2rem 0.8rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>LIVE</span>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.5rem', color: '#fff' }}>Fort San Pedro Full Tour</h3>
                        <p style={{ color: '#a8a29e', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            A complete AR walkthrough of the triangular bastion. Includes 5 guide points and 3 mini-games.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', color: '#d4af37', fontSize: '0.9rem' }}>
                                <i className="fa-solid fa-clock"></i> 45 mins
                                <i className="fa-solid fa-vr-cardboard" style={{ marginLeft: '1rem' }}></i> AR Ready
                            </div>
                            <button className={commonStyles.btnOutline} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Manage</button>
                        </div>
                    </div>
                </div>

                <div className={commonStyles.contentCard} style={{ height: 'auto', flexDirection: 'column', border: '1px dashed #333', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
                    <div style={{ textAlign: 'center', color: '#666' }}>
                        <i className="fa-solid fa-plus-circle" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}></i>
                        <h3>Create New Experience</h3>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstituteTours;
