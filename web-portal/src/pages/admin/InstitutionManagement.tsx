import React, { useEffect, useState } from "react";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";
import { isInstitutionActive, setInstitutionActive } from "../../lib/institutionStatus";
import { syncGeneratedInstitutionTour } from "../../lib/generatedTours";
import { migrateMarkersToLandmarks } from "../../lib/migrateMarkersToLandmarks";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

const InstitutionManagement = () => {
  const { currentUser, currentRole } = useAuth();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentInst, setCurrentInst] = useState<any>(null);
  const [generatingTours, setGeneratingTours] = useState(false);
  const [migratingLandmarks, setMigratingLandmarks] = useState(false);

  /* =====================
     LOAD FROM FIREBASE
  ===================== */
  const fetchInstitutions = async () => {
    const snap = await getDocs(collection(db, "institutions"));

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
  const handleToggleActive = async (institution: any) => {
    const isActive = !isInstitutionActive(institution);
    const action = isActive ? "reactivate" : "deactivate";
    if (!window.confirm(`${isActive ? "Reactivate" : "Deactivate"} ${institution.name}? Its content and analytics will be preserved, but deactivated institutions will no longer be available in the live map or institution portal.`))
      return;
    try {
      await setInstitutionActive(institution.id, isActive);
      setInstitutions((prev) => prev.map((item) =>
        item.id === institution.id ? { ...item, isActive } : item,
      ));
      await writeAuditLog({
        actorId: currentUser?.uid,
        actorRole: currentRole,
        action: `institution.${isActive ? "reactivated" : "deactivated"}`,
        entityType: "institution",
        entityId: institution.id,
      });
    } catch (error) {
      console.error(`Unable to ${action} institution:`, error);
      alert(`Unable to ${action} this institution. Please try again.`);
    }
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

  const handleGenerateTours = async () => {
    if (generatingTours) return;
    setGeneratingTours(true);
    const failures: string[] = [];

    try {
      for (const institution of institutions) {
        try {
          await syncGeneratedInstitutionTour(institution.id, currentUser?.uid);
        } catch (error) {
          console.error(`Unable to generate a tour for ${institution.name}:`, error);
          failures.push(institution.name || institution.id);
        }
      }

      if (failures.length) {
        alert(`Generated tours for ${institutions.length - failures.length} institutions. Failed: ${failures.join(", ")}.`);
      } else {
        alert(`Generated or refreshed tours for ${institutions.length} institutions.`);
      }
    } finally {
      setGeneratingTours(false);
    }
  };

  const handleMigrateMarkers = async () => {
    if (migratingLandmarks) return;
    const confirmed = window.confirm(
      "Copy all documents from the markers collection into landmarks? Existing landmarks documents will not be overwritten, and markers will not be deleted.",
    );
    if (!confirmed) return;

    setMigratingLandmarks(true);
    try {
      const result = await migrateMarkersToLandmarks();
      alert(
        `Landmark migration complete. Copied: ${result.copied}; skipped because the destination ID already exists: ${result.skipped}; source documents: ${result.total}. The markers collection was left unchanged.`,
      );
    } catch (error) {
      console.error("Unable to migrate markers to landmarks:", error);
      alert("The migration did not complete. Some batches may already have copied; it is safe to retry.");
    } finally {
      setMigratingLandmarks(false);
    }
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
      try {
        await syncGeneratedInstitutionTour(currentInst.id, currentUser?.uid);
      } catch (error) {
        console.error("Institution was updated, but its generated tour could not be refreshed:", error);
        alert("The institution was updated, but its generated tour could not be refreshed. Use Generate Tours for Existing Institutions to retry.");
      }
      await writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "institution.updated", entityType: "institution", entityId: currentInst.id, metadata: data });
    } else {
      const ref = await addDoc(collection(db, "institutions"), data);
      setInstitutions((prev) => [...prev, { id: ref.id, ...data }]);
      try {
        await syncGeneratedInstitutionTour(ref.id, currentUser?.uid);
      } catch (error) {
        console.error("Institution was created, but its generated tour could not be created:", error);
        alert("The institution was created, but its tour could not be generated. Use Generate Tours for Existing Institutions to retry.");
      }
      await writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "institution.created", entityType: "institution", entityId: ref.id, metadata: data });
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
        <button
          type="button"
          className={tableStyles.btnAction}
          onClick={handleGenerateTours}
          disabled={generatingTours || institutions.length === 0}
        >
          {generatingTours ? "Generating tours..." : "Generate Tours for Existing Institutions"}
        </button>
        <button
          type="button"
          className={tableStyles.btnAction}
          onClick={handleMigrateMarkers}
          disabled={migratingLandmarks}
        >
          {migratingLandmarks ? "Migrating landmarks..." : "Migrate Markers to Landmarks"}
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
            <th>Status</th>
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
                <td>{isInstitutionActive(inst) ? "Active" : "Inactive"}</td>

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
                    title={isInstitutionActive(inst) ? "Deactivate" : "Reactivate"}
                    style={{ borderColor: isInstitutionActive(inst) ? "#ef4444" : "#4ade80", color: isInstitutionActive(inst) ? "#ef4444" : "#4ade80" }}
                    onClick={() => handleToggleActive(inst)}
                  >
                    <i className={`fa-solid ${isInstitutionActive(inst) ? "fa-ban" : "fa-circle-check"}`}></i>
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
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
