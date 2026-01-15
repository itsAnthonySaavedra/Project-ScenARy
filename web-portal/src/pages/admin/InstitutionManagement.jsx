import React, { useState } from 'react';
import tableStyles from '../../components/common/Tables.module.css';
import commonStyles from '../../components/common/Common.module.css';
import Modal from '../../components/common/Modal';

const InstitutionManagement = () => {
    const [institutions, setInstitutions] = useState([
        { id: 1, name: 'Fort San Pedro', location: 'Cebu City', curator: 'Miguel Lopez', joined: '2024-01-15' },
        { id: 2, name: 'Magellan\'s Cross', location: 'Cebu City', curator: 'Sarah Chen', joined: '2024-02-10' },
        { id: 3, name: 'Basilica del Santo Niño', location: 'Cebu City', curator: 'Fr. John Doe', joined: '2024-03-22' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentInst, setCurrentInst] = useState(null);

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to remove this institution?')) {
            setInstitutions(institutions.filter(inst => inst.id !== id));
        }
    };

    const handleEdit = (inst) => {
        setCurrentInst(inst);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setCurrentInst(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentInst(null);
    };

    const handleSave = (e) => {
        e.preventDefault();
        handleCloseModal();
    };

    const filteredInstitutions = institutions.filter(inst =>
        inst.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const modalActions = (
        <>
            <button className={commonStyles.btnCancel} onClick={handleCloseModal}>Cancel</button>
            <button className={commonStyles.btnUpdate} onClick={handleSave}>
                {currentInst ? 'Update' : 'Register'}
            </button>
        </>
    );

    return (
        <div className={tableStyles.tableContainer}>
            <div className={tableStyles.controls}>
                <input
                    type="text"
                    className={tableStyles.searchBar}
                    placeholder="Search institutions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className={tableStyles.btnAdd} onClick={handleAdd}>
                    <i className="fa-solid fa-plus" style={{ marginRight: '0.5rem' }}></i> Register Institution
                </button>
            </div>

            <table className={tableStyles.adminTable}>
                <thead>
                    <tr>
                        <th>Institution Name</th>
                        <th>Location</th>
                        <th>Head Curator</th>
                        <th>Date Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredInstitutions.length > 0 ? filteredInstitutions.map((inst) => (
                        <tr key={inst.id}>
                            <td style={{ fontWeight: '500', color: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <div style={{ width: '30px', height: '30px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-landmark" style={{ fontSize: '0.7rem', color: '#d4af37' }}></i>
                                    </div>
                                    {inst.name}
                                </div>
                            </td>
                            <td>{inst.location}</td>
                            <td>{inst.curator}</td>
                            <td>{inst.joined}</td>
                            <td>
                                <button className={tableStyles.btnAction} title="View Details" onClick={() => handleEdit(inst)}>
                                    <i className="fa-solid fa-eye"></i>
                                </button>
                                <button className={tableStyles.btnAction} title="Settings" onClick={() => handleEdit(inst)}>
                                    <i className="fa-solid fa-cog"></i>
                                </button>
                                <button
                                    className={tableStyles.btnAction}
                                    title="Delete"
                                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                                    onClick={() => handleDelete(inst.id)}
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No institutions found</td></tr>
                    )}
                </tbody>
            </table>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={currentInst ? 'Institution Details' : 'Register Institution'}
                actions={modalActions}
            >
                <form className={commonStyles.formGroup} onSubmit={handleSave}>
                    <div className={commonStyles.formGroup}>
                        <label>Institution Name</label>
                        <input
                            type="text"
                            className={commonStyles.formControl}
                            defaultValue={currentInst?.name}
                            placeholder="Enter name"
                        />
                    </div>
                    <div className={commonStyles.formGroup}>
                        <label>Location</label>
                        <input
                            type="text"
                            className={commonStyles.formControl}
                            defaultValue={currentInst?.location}
                            placeholder="Enter location"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default InstitutionManagement;
