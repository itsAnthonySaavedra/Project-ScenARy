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
  role: "super admin" | "admin" | "institution" | "user";
  status: "Active" | "Inactive";
  institutionId?: string | null;
}

interface Institution {
  id: string;
  name: string;
}

const roles: UserType["role"][] = [
  "super admin",
  "admin",
  "institution",
  "user",
];

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);

  /* =====================
     LOAD DATA
  ===================== */
  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setUsers(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UserType, "id">),
      })),
    );
  };

  const fetchInstitutions = async () => {
    const snap = await getDocs(collection(db, "institutions"));
    setInstitutions(
      snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
      })),
    );
  };

  useEffect(() => {
    fetchUsers();
    fetchInstitutions();
  }, []);

  /* =====================
     ACTIONS
  ===================== */
  const handleDelete = async (user: UserType) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name}?`))
      return;
    await deleteDoc(doc(db, "users", user.id));
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
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

  /* =====================
     SAVE USER
  ===================== */
  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as typeof e.target & {
      name: { value: string };
      email: { value: string };
      role: { value: UserType["role"] };
      institutionId?: { value: string };
    };

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const role = form.role.value;
    const institutionId =
      role === "institution" ? form.institutionId?.value || null : null;

    setLoading(true);

    try {
      if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.id), {
          name,
          email,
          role,
          institutionId,
        });

        setUsers((prev) =>
          prev.map((u) =>
            u.id === currentUser.id
              ? { ...u, name, email, role, institutionId }
              : u,
          ),
        );
      } else {
        const tempPassword = "TempPass123!";
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          tempPassword,
        );

        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          email,
          role,
          institutionId,
          status: "Active",
        });

        setUsers((prev) => [
          ...prev,
          {
            id: cred.user.uid,
            name,
            email,
            role,
            institutionId,
            status: "Active",
          },
        ]);
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving user");
    }

    setLoading(false);
    handleCloseModal();
  };

  /* =====================
     FILTER
  ===================== */
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  /* =====================
     UI
  ===================== */
  return (
    <div className={tableStyles.tableContainer}>
      <div className={tableStyles.controls}>
        <input
          type="text"
          className={tableStyles.searchBar}
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
            <th>Institution</th>
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
                <td>{user.role}</td>
                <td>
                  {user.role === "institution"
                    ? institutions.find((i) => i.id === user.institutionId)
                        ?.name || "—"
                    : "—"}
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
              <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
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
        actions={
          <>
            <button
              className={commonStyles.btnCancel}
              onClick={handleCloseModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="userForm"
              className={commonStyles.btnUpdate}
              disabled={loading}
            >
              {currentUser ? "Update User" : "Add User"}
            </button>
          </>
        }
      >
        <form id="userForm" onSubmit={handleSave}>
          <div className={commonStyles.formGroup}>
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              className={commonStyles.formControl}
              defaultValue={currentUser?.name}
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
              required
            />
          </div>

          <div className={commonStyles.formGroup}>
            <label>Role</label>
            <select
              name="role"
              className={commonStyles.formControl}
              defaultValue={currentUser?.role || "user"}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {(currentUser?.role === "institution" || !currentUser) && (
            <div className={commonStyles.formGroup}>
              <label>Institution</label>
              <select
                name="institutionId"
                className={commonStyles.formControl}
                defaultValue={currentUser?.institutionId || ""}
              >
                <option value="">Select institution</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default UserManagement;
