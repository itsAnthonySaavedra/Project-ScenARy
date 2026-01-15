import React, { useState } from 'react';
import tableStyles from '../../components/common/Tables.module.css';
import commonStyles from '../../components/common/Common.module.css';
import Modal from '../../components/common/Modal';

const ContentManagement = () => {
    const [contents, setContents] = useState([
        { id: 1, title: 'Battle of Mactan', institute: 'Lapu-Lapu Shrine', type: 'Historical Event', status: 'Published' },
        { id: 2, title: 'Fort Architecture', institute: 'Fort San Pedro', type: 'Architectural', status: 'Published' },
        { id: 3, title: 'Introduction to Cebu', institute: 'Museo Sugbo', type: 'General Info', status: 'Draft' },
    ]);
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentContent, setCurrentContent] = useState(null);

    const handlePublish = (id) => {
        setContents(contents.map(item => item.id === id ? { ...item, status: 'Published' } : item));
    };

    const handleView = (item) => {
        setCurrentContent(item);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentContent(null);
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredContents = contents
        .filter(c => filter === 'All' ? true : c.status !== 'Published')
        .filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));

    const modalActions = (
        <button className={commonStyles.btnCancel} onClick={handleCloseModal}>Close</button>
    );

    return (
        <div className={tableStyles.tableContainer}>
            <div className={tableStyles.controls}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className={`${tableStyles.tabBtn} ${filter === 'All' ? tableStyles.active : ''}`}
                        onClick={() => setFilter('All')}
                    >
                        All Content
                    </button>
                    <button
                        className={`${tableStyles.tabBtn} ${filter === 'Pending' ? tableStyles.active : ''}`}
                        onClick={() => setFilter('Pending')}
                    >
                        Pending Review
                    </button>
                </div>
                <input
                    type="text"
                    className={tableStyles.searchBar}
                    placeholder="Search content..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
            </div>

            <table className={tableStyles.adminTable}>
                <thead>
                    <tr>
                        <th>Content Title</th>
                        <th>Institution</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredContents.length > 0 ? filteredContents.map((item) => (
                        <tr key={item.id}>
                            <td style={{ fontWeight: '500', color: '#fff' }}>{item.title}</td>
                            <td>{item.institute}</td>
                            <td>{item.type}</td>
                            <td>
                                <span style={{
                                    color: item.status === 'Published' ? '#4ade80' : '#fbbf24',
                                    border: `1px solid ${item.status === 'Published' ? '#4ade80' : '#fbbf24'}`,
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase'
                                }}>
                                    {item.status}
                                </span>
                            </td>
                            <td>
                                {item.status === 'Draft' ? (
                                    <button
                                        className={tableStyles.btnAction}
                                        title="Approve & Publish"
                                        onClick={() => handlePublish(item.id)}
                                        style={{ color: '#4ade80', borderColor: '#4ade80' }}
                                    >
                                        <i className="fa-solid fa-check"></i>
                                    </button>
                                ) : (
                                    <button className={tableStyles.btnAction} title="View" onClick={() => handleView(item)}>
                                        <i className="fa-solid fa-file-alt"></i>
                                    </button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No content found</td></tr>
                    )}
                </tbody>
            </table>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={currentContent?.title || 'Content Details'}
                actions={modalActions}
            >
                {currentContent && (
                    <div style={{ color: '#ccc' }}>
                        <div className={commonStyles.formGroup}>
                            <label>Title</label>
                            <p className={commonStyles.formControl} style={{ border: 'none', padding: '0.5rem 0' }}>{currentContent.title}</p>
                        </div>
                        <div className={commonStyles.formGroup}>
                            <label>Institution</label>
                            <p className={commonStyles.formControl} style={{ border: 'none', padding: '0.5rem 0' }}>{currentContent.institute}</p>
                        </div>
                        <div className={commonStyles.formGroup}>
                            <label>Type</label>
                            <p className={commonStyles.formControl} style={{ border: 'none', padding: '0.5rem 0' }}>{currentContent.type}</p>
                        </div>
                        <div className={commonStyles.formGroup}>
                            <label>Status</label>
                            <p className={commonStyles.formControl} style={{ border: 'none', padding: '0.5rem 0' }}>{currentContent.status}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ContentManagement;
