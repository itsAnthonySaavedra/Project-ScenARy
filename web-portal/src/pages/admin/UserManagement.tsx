// src/pages/admin/UserManagement.tsx
import React, { useState, useEffect, FormEvent } from "react";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

interface UserType {
  id: string;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Institution" | "User";
  status: "Active" | "Inactive";
}

const roles: UserType["role"][] = [
  "Super Admin",
  "Admin",
  "Institution",
  "User",
];

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);

  // Load users from Firestore
  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const fetchedUsers: UserType[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<UserType, "id">),
      }));
      setUsers(fetchedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      alert("Failed to load users.");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Delete user
  const handleDelete = async (user: UserType) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name}?`))
      return;

    try {
      await deleteDoc(doc(db, "users", user.id));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting user.");
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEdit = (user: UserType) => {
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

  // Save user (create or update)
  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as typeof e.target & {
      name: { value: string };
      email: { value: string };
      role: { value: UserType["role"] };
    };

    const name = form.name.value;
    const email = form.email.value;
    const role = form.role.value as UserType["role"];

    setLoading(true);

    try {
      if (currentUser) {
        // Update existing user
        await updateDoc(doc(db, "users", currentUser.id), {
          name,
          email,
          role,
        });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === currentUser.id ? { ...u, name, email, role } : u,
          ),
        );
      } else {
        // Create new user in Firebase Auth + Firestore
        const tempPassword = "TempPass123!"; // Or generate dynamically
        const userCred = await createUserWithEmailAndPassword(
          auth,
          email,
          tempPassword,
        );

        await setDoc(doc(db, "users", userCred.user.uid), {
          name,
          email,
          role,
          status: "Active",
        });

        setUsers((prev) => [
          ...prev,
          { id: userCred.user.uid, name, email, role, status: "Active" },
        ]);
      }
    } catch (err) {
      console.error("Error saving user:", err);
      alert("Error saving user. See console.");
    }

    setLoading(false);
    handleCloseModal();
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const modalActions = (
    <>
      <button className={commonStyles.btnCancel} onClick={handleCloseModal}>
        Cancel
      </button>
      <button
        type="submit" // submit the form instead of onClick
        form="userForm" // link to the form id
        className={commonStyles.btnUpdate}
        disabled={loading}
      >
        {currentUser ? "Update User" : "Add User"}
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
          <i className="fa-solid fa-plus" style={{ marginRight: "0.5rem" }}></i>
          Add User
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
          {filteredUsers.length ? (
            filteredUsers.map((user) => (
              <tr key={user.id}>
                <td style={{ fontWeight: 500, color: "#fff" }}>{user.name}</td>
                <td>
                  <span
                    style={{
                      padding: "0.25rem 0.8rem",
                      borderRadius: "12px",
                      background:
                        user.role === "Super Admin"
                          ? "rgba(212, 175, 55, 0.2)"
                          : "rgba(255, 255, 255, 0.05)",
                      color:
                        user.role === "Super Admin" ? "#d4af37" : "#a8a29e",
                      fontSize: "0.75rem",
                    }}
                  >
                    {user.role}
                  </span>
                </td>
                <td>{user.email}</td>
                <td>
                  <span
                    style={{
                      color: user.status === "Active" ? "#4ade80" : "#ef4444",
                    }}
                  >
                    {user.status}
                  </span>
                </td>
                <td>
                  <button
                    className={tableStyles.btnAction}
                    title="Edit"
                    onClick={() => handleEdit(user)}
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button
                    className={tableStyles.btnAction}
                    title="Delete"
                    style={{ borderColor: "#ef4444", color: "#ef4444" }}
                    onClick={() => handleDelete(user)}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={5}
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "#a8a29e",
                }}
              >
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={currentUser ? "Edit User" : "Add New User"}
        actions={modalActions}
      >
        <form
          id="userForm"
          className={commonStyles.formGroup}
          onSubmit={handleSave}
        >
          <div className={commonStyles.formGroup}>
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              className={commonStyles.formControl}
              defaultValue={currentUser?.name}
              placeholder="Enter full name"
              required
            />
          </div>
          <div className={commonStyles.formGroup}>
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              className={commonStyles.formControl}
              defaultValue={currentUser?.email}
              placeholder="Enter email address"
              required
            />
          </div>
          <div className={commonStyles.formGroup}>
            <label>Role</label>
            <select
              name="role"
              className={commonStyles.formControl}
              defaultValue={currentUser?.role || "User"}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UserManagement;
