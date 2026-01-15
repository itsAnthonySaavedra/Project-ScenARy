import React, { useState } from 'react';
import tableStyles from '../../components/common/Tables.module.css';
import commonStyles from '../../components/common/Common.module.css';
import Modal from '../../components/common/Modal';

const UserManagement = () => {
    const [users, setUsers] = useState([
        { id: 1, name: 'Admin User', role: 'Super Admin', email: 'admin@scenary.com', status: 'Active' },
        { id: 2, name: 'Fort San Pedro', role: 'Institution', email: 'contact@fortsanpedro.com', status: 'Active' },
        { id: 3, name: 'Joseph Rodrigo', role: 'User', email: 'joseph@email.com', status: 'Active' },
        { id: 4, name: 'Maria Santos', role: 'User', email: 'maria@email.com', status: 'Inactive' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            setUsers(users.filter(user => user.id !== id));
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleEdit = (user) => {
        setCurrentUser(user);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setCurrentUser(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentUser(null);
    };

    const handleSave = (e) => {
        e.preventDefault();
        // In a real app, this would make an API call
        handleCloseModal();
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const modalActions = (
        <>
            <button className={commonStyles.btnCancel} onClick={handleCloseModal}>Cancel</button>
            <button className={commonStyles.btnUpdate} onClick={handleSave}>
                {currentUser ? 'Update User' : 'Add User'}
            </button>
        </>
    );

    return (
        <div className={tableStyles.tableContainer}>
            <div className={tableStyles.controls}>
                <input
                    type="text"
                    className={tableStyles.searchBar}
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
                <button className={tableStyles.btnAdd} onClick={handleAdd}>
                    <i className="fa-solid fa-plus" style={{ marginRight: '0.5rem' }}></i> Add User
                </button>
            </div>

            <table className={tableStyles.adminTable}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                        <tr key={user.id}>
                            <td style={{ fontWeight: '500', color: '#fff' }}>{user.name}</td>
                            <td>
                                <span style={{
                                    padding: '0.25rem 0.8rem',
                                    borderRadius: '12px',
                                    background: user.role === 'Super Admin' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    color: user.role === 'Super Admin' ? '#d4af37' : '#a8a29e',
                                    fontSize: '0.75rem'
                                }}>
                                    {user.role}
                                </span>
                            </td>
                            <td>{user.email}</td>
                            <td>
                                <span style={{ color: user.status === 'Active' ? '#4ade80' : '#ef4444' }}>
                                    {user.status}
                                </span>
                            </td>
                            <td>
                                <button className={tableStyles.btnAction} title="Edit" onClick={() => handleEdit(user)}>
                                    <i className="fa-solid fa-pen"></i>
                                </button>
                                <button
                                    className={tableStyles.btnAction}
                                    title="Delete"
                                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                                    onClick={() => handleDelete(user.id)}
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#a8a29e' }}>No users found</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={currentUser ? 'Edit User' : 'Add New User'}
                actions={modalActions}
            >
                <form className={commonStyles.formGroup} onSubmit={handleSave}>
                    <div className={commonStyles.formGroup}>
                        <label>Full Name</label>
                        <input
                            type="text"
                            className={commonStyles.formControl}
                            defaultValue={currentUser?.name}
                            placeholder="Enter full name"
                        />
                    </div>
                    <div className={commonStyles.formGroup}>
                        <label>Email Address</label>
                        <input
                            type="email"
                            className={commonStyles.formControl}
                            defaultValue={currentUser?.email}
                            placeholder="Enter email address"
                        />
                    </div>
                    <div className={commonStyles.formGroup}>
                        <label>Role</label>
                        <select className={commonStyles.formControl} defaultValue={currentUser?.role || 'User'}>
                            <option>User</option>
                            <option>Institution</option>
                            <option>Super Admin</option>
                        </select>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default UserManagement;
