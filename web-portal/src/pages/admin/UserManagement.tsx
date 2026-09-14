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
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";

interface UserType {
  id: string;
  name: string;
  email: string;
  role: "admin" | "institution" | "user";
  status: "Active" | "Inactive" | "Banned";
  institutionId?: string | null;
  createdAt?: unknown;
}

interface Institution {
  id: string;
  name: string;
  location?: string;
  curator?: string;
  joined?: string;
}

const roles: UserType["role"][] = ["admin", "institution"];

const formatUserDate = (value: unknown) => {
  if (!value) return "Not recorded";
  const timestamp = value as { toDate?: () => Date };
  const date = timestamp.toDate ? timestamp.toDate() : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

// Secondary Firebase app for user creation (won't affect your current session)
const secondaryApp = initializeApp(
  {
    apiKey: "AIzaSyAsKAbgKf5xx7dmEVX82yvleRUW6_n1JEs",
    authDomain: "scenary-4f022.firebaseapp.com",
    projectId: "scenary-4f022",
    storageBucket: "scenary-4f022.firebasestorage.app",
    messagingSenderId: "1053511640232",
    appId: "1:1053511640232:web:c9919ebc339ca0f03a0e9d",
    measurementId: "G-9BL059HZEH",
  },
  "Secondary",
);

const secondaryAuth = getAuth(secondaryApp);

const UserManagement: React.FC = () => {
  const { currentUser: authUser, currentRole } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [detailsUser, setDetailsUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "institutions">("users");
  const [instSearchTerm, setInstSearchTerm] = useState("");
  const [isInstModalOpen, setIsInstModalOpen] = useState(false);
  const [currentInst, setCurrentInst] = useState<Institution | null>(null);

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
        name: d.data().name || "",
        location: d.data().location || "",
        curator: d.data().curator || "",
        joined: d.data().joined || "",
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
  const handleBanToggle = async (user: UserType) => {
    const nextStatus = user.status === "Banned" ? "Active" : "Banned";
    if (!window.confirm(`${nextStatus === "Banned" ? "Ban" : "Unban"} ${user.name}?`))
      return;
    await updateDoc(doc(db, "users", user.id), { status: nextStatus });
    setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, status: nextStatus } : item));
    await writeAuditLog({
      actorId: authUser?.uid,
      actorRole: currentRole,
      action: nextStatus === "Banned" ? "user.banned" : "user.unbanned",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
    });
  };

  const handleDeleteInstitution = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this institution?")) return;
    await deleteDoc(doc(db, "institutions", id));
    setInstitutions((prev) => prev.filter((item) => item.id !== id));
    await writeAuditLog({
      actorId: authUser?.uid,
      actorRole: currentRole,
      action: "institution.deleted",
      entityType: "institution",
      entityId: id,
    });
  };

  const handleInstEdit = (inst: Institution) => {
    setCurrentInst(inst);
    setIsInstModalOpen(true);
  };

  const handleInstAdd = () => {
    setCurrentInst(null);
    setIsInstModalOpen(true);
  };

  const handleInstCloseModal = () => {
    setIsInstModalOpen(false);
    setCurrentInst(null);
  };

  const handleInstSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as any;
    const data = {
      name: form.name.value.trim(),
      location: form.location.value.trim(),
      curator: form.curator.value.trim(),
      joined: currentInst?.joined || new Date().toISOString().split("T")[0],
    };

    if (!data.name || !data.location || !data.curator) return;

    if (currentInst) {
      await updateDoc(doc(db, "institutions", currentInst.id), data);
      setInstitutions((prev) => prev.map((item) => (item.id === currentInst.id ? { ...item, ...data } : item)));
      await writeAuditLog({
        actorId: authUser?.uid,
        actorRole: currentRole,
        action: "institution.updated",
        entityType: "institution",
        entityId: currentInst.id,
        metadata: data,
      });
    } else {
      const ref = await addDoc(collection(db, "institutions"), data);
      setInstitutions((prev) => [...prev, { id: ref.id, ...data }]);
      await writeAuditLog({
        actorId: authUser?.uid,
        actorRole: currentRole,
        action: "institution.created",
        entityType: "institution",
        entityId: ref.id,
        metadata: data,
      });
    }

    handleInstCloseModal();
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

    if (role === "user") {
      alert(
        "Unauthorized: Administrators cannot create accounts with the 'user' role. Please select 'institution' or another valid role.",
      );
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      if (currentUser) {
        // Update existing user
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
        await writeAuditLog({
          actorId: authUser?.uid,
          actorRole: currentRole,
          action: "user.updated",
          entityType: "user",
          entityId: currentUser.id,
          metadata: { email, role, institutionId },
        });
      } else {
        // Create new user using secondary auth (won't log you out!)
        const tempPassword = "TempPass123!";
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          tempPassword,
        );

        // Create user document in Firestore
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          email,
          role,
          institutionId,
          status: "Active",
          createdAt: serverTimestamp(),
        });

        // Sign out from secondary auth immediately (cleanup)
        await secondaryAuth.signOut();

        // Update local state
        setUsers((prev) => [
          ...prev,
          {
            id: cred.user.uid,
            name,
            email,
            role,
            institutionId,
            status: "Active",
            createdAt: new Date().toISOString(),
          },
        ]);

        await writeAuditLog({
          actorId: authUser?.uid,
          actorRole: currentRole,
          action: "user.created",
          entityType: "user",
          entityId: cred.user.uid,
          metadata: { email, role, institutionId },
        });

        alert(
          `User created successfully!\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease share these credentials with the new user.`,
        );
      }
    } catch (err: any) {
      console.error("Save error:", err);

      let errorMessage = "Error saving user";
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      }

      alert(errorMessage);
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

  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(instSearchTerm.toLowerCase()),
  );

  /* =====================
     UI
  ===================== */
  return (
    <div className={tableStyles.tableContainer}>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", borderBottom: "1px solid #333", paddingBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          style={{
            padding: "0.7rem 1rem",
            borderRadius: "6px",
            border: activeTab === "users" ? "1px solid #d4af37" : "1px solid #444",
            background: activeTab === "users" ? "rgba(212, 175, 55, 0.12)" : "transparent",
            color: activeTab === "users" ? "#f5d77a" : "#ddd",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("institutions")}
          style={{
            padding: "0.7rem 1rem",
            borderRadius: "6px",
            border: activeTab === "institutions" ? "1px solid #d4af37" : "1px solid #444",
            background: activeTab === "institutions" ? "rgba(212, 175, 55, 0.12)" : "transparent",
            color: activeTab === "institutions" ? "#f5d77a" : "#ddd",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Institutions
        </button>
      </div>

      {activeTab === "users" ? (
        <>
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
                        ? institutions.find((i) => i.id === user.institutionId)?.name || "—"
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
                        title="View details"
                        onClick={() => setDetailsUser(user)}
                      >
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button
                        className={tableStyles.btnAction}
                        title="Edit"
                        onClick={() => handleEdit(user)}
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        className={tableStyles.btnAction}
                        title={user.status === "Banned" ? "Unban account" : "Ban account"}
                        style={{ borderColor: user.status === "Banned" ? "#4ade80" : "#ef4444", color: user.status === "Banned" ? "#4ade80" : "#ef4444" }}
                        onClick={() => handleBanToggle(user)}
                      >
                        <i className={`fa-solid ${user.status === "Banned" ? "fa-user-check" : "fa-user-slash"}`}></i>
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
            isOpen={Boolean(detailsUser)}
            onClose={() => setDetailsUser(null)}
            title="User Details"
          >
            {detailsUser && (
              <div style={{ color: "#ddd" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div><small style={{ color: "#999" }}>Name</small><p>{detailsUser.name || "-"}</p></div>
                  <div><small style={{ color: "#999" }}>Email</small><p>{detailsUser.email || "-"}</p></div>
                  <div><small style={{ color: "#999" }}>Role</small><p>{detailsUser.role || "-"}</p></div>
                  <div><small style={{ color: "#999" }}>Status</small><p>{detailsUser.status || "-"}</p></div>
                  <div><small style={{ color: "#999" }}>Institution</small><p>{institutions.find((item) => item.id === detailsUser.institutionId)?.name || "-"}</p></div>
                  <div><small style={{ color: "#999" }}>Date joined</small><p>{formatUserDate(detailsUser.createdAt)}</p></div>
                </div>
                <small style={{ color: "#999" }}>Firebase user ID</small>
                <p style={{ wordBreak: "break-all" }}>{detailsUser.id}</p>
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentUser ? "Edit User" : "Add New User"}
            actions={
              <>
                <button className={commonStyles.btnCancel} onClick={handleCloseModal}>Cancel</button>
                <button type="submit" form="userForm" className={commonStyles.btnUpdate} disabled={loading}>
                  {currentUser ? "Update User" : "Add User"}
                </button>
              </>
            }
          >
            <form id="userForm" onSubmit={handleSave}>
              <div className={commonStyles.formGroup}>
                <label>Full Name</label>
                <input type="text" name="name" className={commonStyles.formControl} defaultValue={currentUser?.name} required />
              </div>

              <div className={commonStyles.formGroup}>
                <label>Email Address</label>
                <input type="email" name="email" className={commonStyles.formControl} defaultValue={currentUser?.email} required />
              </div>

              <div className={commonStyles.formGroup}>
                <label>Role</label>
                <select name="role" className={commonStyles.formControl} defaultValue={currentUser?.role || "institution"}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {(currentUser?.role === "institution" || !currentUser) && (
                <div className={commonStyles.formGroup}>
                  <label>Institution</label>
                  <select name="institutionId" className={commonStyles.formControl} defaultValue={currentUser?.institutionId || ""}>
                    <option value="">Select institution</option>
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </form>
          </Modal>
        </>
      ) : (
        <>
          <div className={tableStyles.controls}>
            <input
              type="text"
              className={tableStyles.searchBar}
              placeholder="Search institutions..."
              value={instSearchTerm}
              onChange={(e) => setInstSearchTerm(e.target.value)}
            />
            <button className={tableStyles.btnAdd} onClick={handleInstAdd}>
              <i className="fa-solid fa-plus" style={{ marginRight: "0.5rem" }}></i>
              Register Institution
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
              {filteredInstitutions.length > 0 ? (
                filteredInstitutions.map((inst) => (
                  <tr key={inst.id}>
                    <td style={{ fontWeight: 500, color: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                        <div style={{ width: "30px", height: "30px", background: "#333", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="fa-solid fa-landmark" style={{ fontSize: "0.7rem", color: "#d4af37" }}></i>
                        </div>
                        {inst.name}
                      </div>
                    </td>
                    <td>{inst.location || "—"}</td>
                    <td>{inst.curator || "—"}</td>
                    <td>{inst.joined || "—"}</td>
                    <td>
                      <button className={tableStyles.btnAction} title="Edit" onClick={() => handleInstEdit(inst)}>
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className={tableStyles.btnAction} title="Delete" style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => handleDeleteInstitution(inst.id)}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>No institutions found</td>
                </tr>
              )}
            </tbody>
          </table>

          <Modal
            isOpen={isInstModalOpen}
            onClose={handleInstCloseModal}
            title={currentInst ? "Institution Details" : "Register Institution"}
            actions={
              <>
                <button className={commonStyles.btnCancel} onClick={handleInstCloseModal}>Cancel</button>
                <button type="submit" form="instForm" className={commonStyles.btnUpdate}>{currentInst ? "Update" : "Register"}</button>
              </>
            }
          >
            <form id="instForm" onSubmit={handleInstSave}>
              <div className={commonStyles.formGroup}>
                <label>Institution Name</label>
                <input name="name" className={commonStyles.formControl} defaultValue={currentInst?.name} required />
              </div>

              <div className={commonStyles.formGroup}>
                <label>Location</label>
                <input name="location" className={commonStyles.formControl} defaultValue={currentInst?.location} required />
              </div>

              <div className={commonStyles.formGroup}>
                <label>Head Curator</label>
                <input name="curator" className={commonStyles.formControl} defaultValue={currentInst?.curator} required />
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default UserManagement;
