import React, { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import Modal from '../../components/common/Modal';
import dashboardStyles from '../../components/features/dashboard/Dashboard.module.css';
import commonStyles from '../../components/common/Common.module.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const InstituteDashboard = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const engagementData = {
        labels: ['Fact', 'Info', 'Quiz'],
        datasets: [{
            data: [53.3, 13.3, 33.3],
            backgroundColor: ['#d4af37', '#855e2e', '#4a4a4a'],
            borderWidth: 0,
        }],
    };

    const quizData = {
        labels: ['7', '14'],
        datasets: [{
            data: [7, 14],
            backgroundColor: '#d4af37',
            barThickness: 20,
        }],
    };

    const viewsData = {
        labels: ['2025-2', '2025-3', '2025-4', '2025-5', '2025-6'],
        datasets: [{
            data: [10, 20, 25, 22, 40],
            borderColor: '#d4af37',
            tension: 0.1,
            pointRadius: 0,
        }],
    };

    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
    const doughnutOptions = { ...chartOptions, cutout: '40%' };
    const axisOptions = {
        ...chartOptions,
        scales: {
            y: { display: false },
            x: { grid: { display: false }, ticks: { color: '#a8a29e' } }
        }
    };

    return (
        <div>
            {/* Custom Sub-Navigation */}
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <button
                    className={`${commonStyles.tabBtn} ${activeView === 'dashboard' ? commonStyles.tabBtnActive : ''}`}
                    onClick={() => setActiveView('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    className={`${commonStyles.tabBtn} ${activeView === 'content' ? commonStyles.tabBtnActive : ''}`}
                    onClick={() => setActiveView('content')}
                >
                    Content
                </button>
                <button
                    className={`${commonStyles.tabBtn} ${activeView === 'analytics' ? commonStyles.tabBtnActive : ''}`}
                    onClick={() => setActiveView('analytics')}
                >
                    Analytics
                </button>
                <button
                    className={`${commonStyles.tabBtn} ${activeView === 'settings' ? commonStyles.tabBtnActive : ''}`}
                    onClick={() => setActiveView('settings')}
                >
                    Settings
                </button>
            </div>

            {/* VIEW: DASHBOARD */}
            {activeView === 'dashboard' && (
                <div className={dashboardStyles.chartsGrid}>
                    <div className={dashboardStyles.chartCard}>
                        <h3>Total Engagement Type</h3>
                        <div className={dashboardStyles.chartContainer}>
                            <Doughnut data={engagementData} options={doughnutOptions} />
                        </div>
                        <div className="chart-legend" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#ccc' }}>
                            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#d4af37', marginRight: '5px' }}></span> Fact 53.3%</span>
                            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#855e2e', marginRight: '5px' }}></span> Info 13.3%</span>
                            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4a4a4a', marginRight: '5px' }}></span> Quiz 33.3%</span>
                        </div>
                    </div>

                    <div className={dashboardStyles.chartCard}>
                        <h3>Frequent Site Quiz Update</h3>
                        <div className={dashboardStyles.chartContainer}>
                            <Bar data={quizData} options={axisOptions} />
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#a8a29e', marginTop: '0.5rem' }}>Day</div>
                    </div>

                    <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}>
                        <h3>Daily User View of 3D Site</h3>
                        <div className={dashboardStyles.chartContainer}>
                            <Line data={viewsData} options={axisOptions} />
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW: CONTENT MANAGEMENT */}
            {activeView === 'content' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
                        <button className={`${commonStyles.btnPrimary} btn-add`} onClick={() => setIsAddModalOpen(true)}>
                            <i className="fa-solid fa-plus"></i> ADD
                        </button>
                        <button className={`${commonStyles.btnOutline} btn-edit`} onClick={() => setIsEditModalOpen(true)}>
                            <i className="fa-solid fa-pen-to-square"></i> EDIT
                        </button>
                    </div>

                    <div className={commonStyles.contentCard}>
                        <div className={commonStyles.contentImage}>
                            {/* Assuming assets are at root /assets */}
                            <img src="/assets/images/fort_san_pedro.png" alt="Fort San Pedro" />
                        </div>
                        <div className={commonStyles.contentDetails}>
                            <p className={commonStyles.contentDescription}>
                                Fuerza de San Pedro is a military defense structure in Cebu (Philippines), built by the Spanish under
                                the command of Miguel López de Legazpi. It is located in the area now called Plaza Independencia...
                            </p>
                            <div style={{ marginBottom: '1rem', color: 'var(--color-accent-gold)' }}>
                                <i className="fa-solid fa-chevron-down"></i>
                            </div>
                            <a href="#" className={commonStyles.contentLink}>INFORMATION <i className="fa-solid fa-chevron-right"></i></a>
                        </div>
                        <div className={commonStyles.contentTitleOverlay}>
                            <h3>Fort San Pedro</h3>
                            <p>Plaza Independencia, Cebu City</p>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW: ANALYTICS */}
            {activeView === 'analytics' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <button className={dashboardStyles.chartCard} style={{ cursor: 'pointer', textAlign: 'center', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>Engagement</button>
                    <button className={dashboardStyles.chartCard} style={{ cursor: 'pointer', textAlign: 'center', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>Education</button>
                    <button className={dashboardStyles.chartCard} style={{ cursor: 'pointer', textAlign: 'center', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>Historical Trend</button>
                    <button className={dashboardStyles.chartCard} style={{ cursor: 'pointer', textAlign: 'center', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>Feedback</button>
                </div>
            )}

            {/* VIEW: SETTINGS */}
            {activeView === 'settings' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div className={dashboardStyles.chartCard} style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ width: '80px', height: '80px', background: 'rgba(212, 175, 55, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#d4af37', fontSize: '2rem' }}>
                            <i className="fa-solid fa-shapes"></i>
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="fa-solid fa-pen" style={{ fontSize: '0.8rem', color: '#666' }}></i>
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Fort San Pedro</h2>
                            </div>
                            <p style={{ color: '#888' }}>Institute Name</p>
                        </div>
                        <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#d4af37', border: '1px solid #d4af37', display: 'inline-block', padding: '0.2rem 1rem', borderRadius: '20px' }}>Institute Profile</div>
                    </div>

                    <div className={dashboardStyles.chartCard} style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{ position: 'relative', width: '60px', height: '30px' }}>
                            {/* Simple Toggle Switch Mockup */}
                            <div style={{ width: '100%', height: '100%', background: '#333', borderRadius: '15px', position: 'relative' }}>
                                <div style={{ width: '26px', height: '26px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px' }}></div>
                            </div>
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0' }}>Maintenance Mode</h3>
                            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>Read, quiz, and fact will be unavailable for user when turned on</p>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Information">
                <div className="upload-area" style={{ border: '2px dashed #444', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', color: '#888' }}>
                    <i className="fa-regular fa-image" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
                    <p>Upload your photo here</p>
                    <button className={commonStyles.btnOutline} style={{ marginTop: '1rem' }}>Browse File</button>
                </div>
                <textarea className={commonStyles.formControl} style={{ minHeight: '100px', marginBottom: '1.5rem' }} placeholder="Enter historical details here..."></textarea>
                <div className={commonStyles.modalActions}>
                    <button className={commonStyles.btnCancel} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                    <button className={commonStyles.btnUpdate}>Publish</button>
                </div>
            </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    <div style={{ color: '#ef4444', cursor: 'pointer' }}><i className="fa-regular fa-trash-can"></i> Delete Entry</div>
                    <div style={{ color: '#d4af37', cursor: 'pointer' }}><i className="fa-solid fa-pen"></i> Edit Text</div>
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                        <img src="/assets/images/fort_san_pedro.png" style={{ width: '100%', borderRadius: '8px', marginBottom: '1rem' }} alt="Preview" />
                        <p style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>Notice: Photo cannot be edited.</p>
                        <h4>Fort San Pedro</h4>
                        <p style={{ fontSize: '0.8rem', color: '#888' }}>Plaza Independencia, Cebu City</p>
                    </div>
                    <div style={{ flex: 1 }}>
                        <textarea className={commonStyles.formControl} style={{ height: '100%' }} defaultValue="Fuerza de San Pedro..." />
                    </div>
                </div>
                <div className={commonStyles.modalActions} style={{ marginTop: '2rem' }}>
                    <button className={commonStyles.btnCancel} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                    <button className={commonStyles.btnUpdate}>Update</button>
                </div>
            </Modal>
        </div>
    );
};

export default InstituteDashboard;
