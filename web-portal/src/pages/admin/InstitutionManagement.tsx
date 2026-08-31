import React, { useEffect, useState } from "react";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";
import { db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const InstitutionManagement = () => {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentInst, setCurrentInst] = useState<any>(null);

  /* =====================
     LOAD FROM FIREBASE
  ===================== */
  const fetchInstitutions = async () => {
    console.log("Fetching institutions...");
    const snap = await getDocs(collection(db, "institutions"));

    console.log("Docs count:", snap.size);
    snap.docs.forEach((d) => {
      console.log("Doc:", d.id, d.data());
    });

    setInstitutions(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })),
    );
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  /* =====================
     ACTIONS
  ===================== */
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this institution?"))
      return;
    await deleteDoc(doc(db, "institutions", id));
    setInstitutions((prev) => prev.filter((i) => i.id !== id));
  };

  const handleEdit = (inst: any) => {
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

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as any;

    const data = {
      name: form.name.value,
      location: form.location.value,
      curator: form.curator.value,
      joined: currentInst?.joined || new Date().toISOString().split("T")[0],
    };

    if (currentInst) {
      await updateDoc(doc(db, "institutions", currentInst.id), data);
      setInstitutions((prev) =>
        prev.map((i) => (i.id === currentInst.id ? { ...i, ...data } : i)),
      );
    } else {
      const ref = await addDoc(collection(db, "institutions"), data);
      setInstitutions((prev) => [...prev, { id: ref.id, ...data }]);
    }

    handleCloseModal();
  };

  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  /* =====================
     UI
  ===================== */
  return (
    <div className={tableStyles.tableContainer}>
      {/* CONTROLS */}
      <div className={tableStyles.controls}>
        <input
          type="text"
          className={tableStyles.searchBar}
          placeholder="Search institutions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className={tableStyles.btnAdd} onClick={handleAdd}>
          <i className="fa-solid fa-plus" style={{ marginRight: "0.5rem" }}></i>
          Register Institution
        </button>
      </div>

      {/* TABLE */}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                    }}
                  >
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        background: "#333",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className="fa-solid fa-landmark"
                        style={{ fontSize: "0.7rem", color: "#d4af37" }}
                      ></i>
                    </div>
                    {inst.name}
                  </div>
                </td>

                <td>{inst.location}</td>
                <td>{inst.curator}</td>
                <td>{inst.joined}</td>

                <td>
                  <button
                    className={tableStyles.btnAction}
                    title="View Details"
                    onClick={() => handleEdit(inst)}
                  >
                    <i className="fa-solid fa-eye"></i>
                  </button>

                  <button
                    className={tableStyles.btnAction}
                    title="Settings"
                    onClick={() => handleEdit(inst)}
                  >
                    <i className="fa-solid fa-cog"></i>
                  </button>

                  <button
                    className={tableStyles.btnAction}
                    title="Delete"
                    style={{ borderColor: "#ef4444", color: "#ef4444" }}
                    onClick={() => handleDelete(inst.id)}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                No institutions found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={currentInst ? "Institution Details" : "Register Institution"}
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
              form="instForm"
              className={commonStyles.btnUpdate}
            >
              {currentInst ? "Update" : "Register"}
            </button>
          </>
        }
      >
        <form id="instForm" onSubmit={handleSave}>
          <div className={commonStyles.formGroup}>
            <label>Institution Name</label>
            <input
              name="name"
              className={commonStyles.formControl}
              defaultValue={currentInst?.name}
              required
            />
          </div>

          <div className={commonStyles.formGroup}>
            <label>Location</label>
            <input
              name="location"
              className={commonStyles.formControl}
              defaultValue={currentInst?.location}
              required
            />
          </div>

          <div className={commonStyles.formGroup}>
            <label>Head Curator</label>
            <input
              name="curator"
              className={commonStyles.formControl}
              defaultValue={currentInst?.curator}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InstitutionManagement;
