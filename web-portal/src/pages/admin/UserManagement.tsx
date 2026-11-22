// src/pages/admin/UserManagement.tsx
import React, { useState, useEffect, FormEvent } from "react";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  deleteField,
  writeBatch,
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";
import { isInstitutionActive, setInstitutionActive } from "../../lib/institutionStatus";
import { syncGeneratedInstitutionTour } from "../../lib/generatedTours";
import { getInstitutionContentReadiness } from "../../lib/contentQuality";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";

interface UserType {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin" | "institution" | "curator" | "3d-modeler" | "user";
  status: "Active" | "Deactivated" | "Inactive" | "Banned";
  institutionId?: string | null;
  institutionIds?: string[];
  canPreviewUnpublishedSite?: boolean;
  createdAt?: unknown;
  mustChangePassword?: boolean;
}

type UserAssignmentRole = "admin" | "superadmin" | "curator" | "3d-modeler";

interface Institution {
  id: string;
  name: string;
  location?: string;
  curator?: string;
  joined?: string;
  isActive?: boolean;
  requiresPaidAccess?: boolean;
  dayPassPriceCentavos?: number | null;
}

interface SiteAccessRecord {
  status?: string;
  durationMs?: number;
  expiresAt?: { toDate?: () => Date };
}

interface SiteAccessRevenueRecord {
  amountCentavos?: number;
  currency?: string;
}

const DEFAULT_SITE_ACCESS_DURATION_MS = 24 * 60 * 60 * 1000;
const SITE_ACCESS_TEST_DURATION_MS = 60 * 1000;

const formatAccessDuration = (durationMs: number) => {
  const units = [
    { milliseconds: 24 * 60 * 60 * 1000, label: "day" },
    { milliseconds: 60 * 60 * 1000, label: "hour" },
    { milliseconds: 60 * 1000, label: "minute" },
    { milliseconds: 1000, label: "second" },
    { milliseconds: 1, label: "millisecond" },
  ];
  const unit = units.find(({ milliseconds }) =>
    durationMs >= milliseconds && durationMs % milliseconds === 0,
  ) || units[units.length - 1];
  const amount = durationMs / unit.milliseconds;
  return `${amount} ${unit.label}${amount === 1 ? "" : "s"}`;
};

const siteAccessDurationOptions = [
  {
    durationMs: SITE_ACCESS_TEST_DURATION_MS,
    label: `Test pass for ${formatAccessDuration(SITE_ACCESS_TEST_DURATION_MS)} (no revenue)`,
  },
  { durationMs: DEFAULT_SITE_ACCESS_DURATION_MS, label: "Paid for 24 hours" },
];

const isSiteAccessPaid = (record: SiteAccessRecord | undefined, now: number) =>
  record?.status === "paid" &&
  (record.expiresAt?.toDate?.().getTime() ?? 0) > now;

const formatPhp = (amountCentavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amountCentavos / 100);

const generateTemporaryPassword = () => {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = crypto.getRandomValues(new Uint32Array(24));
  return Array.from(values, (value) => characters[value % characters.length]).join("");
};

const formatUserDate = (value: unknown) => {
  if (!value) return "Not recorded";
  const timestamp = value as { toDate?: () => Date };
  const date = timestamp.toDate ? timestamp.toDate() : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const getUserStatusLabel = (status: UserType["status"]) =>
  status === "Active" ? "Active" : "Deactivated";

const getUserInstitutionIds = (user: Pick<UserType, "institutionId" | "institutionIds"> | null | undefined): string[] => {
  if (!user) return [];
  const fromArray = Array.isArray(user.institutionIds)
    ? user.institutionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const fromSingle = user.institutionId ? [String(user.institutionId).trim()] : [];
  return [...new Set([...fromArray, ...fromSingle])];
};

const hasUnpublishedSitePreview = (user: UserType) =>
  user.canPreviewUnpublishedSite === true ||
  (user.canPreviewUnpublishedSite === undefined &&
    ["institution", "curator", "3d-modeler"].includes(user.role) &&
    getUserInstitutionIds(user).length > 0);

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
  const [contentItems, setContentItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserAssignmentRole>("curator");
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<string[]>([]);
  const [detailsUser, setDetailsUser] = useState<UserType | null>(null);
  const [resendingSetupLinkFor, setResendingSetupLinkFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [userFormError, setUserFormError] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "institutions">("users");
  const [instSearchTerm, setInstSearchTerm] = useState("");
  const [isInstModalOpen, setIsInstModalOpen] = useState(false);
  const [currentInst, setCurrentInst] = useState<Institution | null>(null);
  const [institutionFormError, setInstitutionFormError] = useState("");
  const [savingInstitution, setSavingInstitution] = useState(false);
  const [pageLoadError, setPageLoadError] = useState("");
  const [readinessLoadError, setReadinessLoadError] = useState("");
  const [accessSiteId, setAccessSiteId] = useState("");
  const [siteAccessByUser, setSiteAccessByUser] = useState<Record<string, SiteAccessRecord>>({});
  const [siteAccessLoading, setSiteAccessLoading] = useState(false);
  const [siteAccessSavingUserId, setSiteAccessSavingUserId] = useState("");
  const [siteAccessError, setSiteAccessError] = useState("");
  const [siteAccessNow, setSiteAccessNow] = useState(() => Date.now());
  const [siteAccessRevenueCentavos, setSiteAccessRevenueCentavos] = useState(0);
  const [siteAccessRevenueCount, setSiteAccessRevenueCount] = useState(0);
  const [siteAccessRevenueLoading, setSiteAccessRevenueLoading] = useState(false);
  const [siteAccessRevenueError, setSiteAccessRevenueError] = useState("");
  const accessSite = institutions.find((institution) => institution.id === accessSiteId);

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
        isActive: d.data().isActive !== false,
        requiresPaidAccess: d.data().requiresPaidAccess === true,
        dayPassPriceCentavos: Number.isSafeInteger(d.data().dayPassPriceCentavos)
          ? d.data().dayPassPriceCentavos
          : null,
      })),
    );
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchInstitutions()]).catch((error) => {
      console.error("Unable to load user management data:", error);
      setPageLoadError(
        getFirebaseErrorMessage(error, "Unable to load management data. Refresh and try again."),
      );
    });

    return onSnapshot(
      collection(db, "content"),
      (snapshot) => {
        setContentItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setReadinessLoadError("");
      },
      (error) => {
        console.error("Unable to load site readiness content:", error);
        setReadinessLoadError(
          getFirebaseErrorMessage(error, "Unable to load site readiness data."),
        );
      },
    );
  }, []);

  useEffect(() => {
    if (!accessSiteId && institutions.length > 0) {
      setAccessSiteId(institutions[0].id);
    }
  }, [accessSiteId, institutions]);

  useEffect(() => {
    if (!accessSiteId) {
      setSiteAccessByUser({});
      return undefined;
    }

    setSiteAccessLoading(true);
    setSiteAccessError("");

    return onSnapshot(
      collection(db, "siteAccess", accessSiteId, "users"),
      (snapshot) => {
        setSiteAccessByUser(
          Object.fromEntries(
            snapshot.docs.map((accessDoc) => [accessDoc.id, accessDoc.data()]),
          ),
        );
        setSiteAccessLoading(false);
        setSiteAccessError("");
      },
      (error) => {
        console.error("Unable to load site access statuses:", error);
        setSiteAccessError(
          getFirebaseErrorMessage(error, "Unable to load site access statuses."),
        );
        setSiteAccessLoading(false);
      },
    );
  }, [accessSiteId]);

  useEffect(() => {
    const nextExpiry = Object.values(siteAccessByUser)
      .filter((record) => record.status === "paid")
      .map((record) => record.expiresAt?.toDate?.().getTime())
      .filter((expiresAt): expiresAt is number =>
        Number.isFinite(expiresAt) && expiresAt > siteAccessNow,
      )
      .sort((first, second) => first - second)[0];

    if (nextExpiry === undefined) return undefined;
    const timer = window.setTimeout(
      () => setSiteAccessNow(Date.now()),
      nextExpiry - siteAccessNow,
    );
    return () => window.clearTimeout(timer);
  }, [siteAccessByUser, siteAccessNow]);

  useEffect(() => {
    if (!accessSiteId) {
      setSiteAccessRevenueCentavos(0);
      setSiteAccessRevenueCount(0);
      setSiteAccessRevenueLoading(false);
      setSiteAccessRevenueError("");
      return undefined;
    }

    setSiteAccessRevenueLoading(true);
    setSiteAccessRevenueCentavos(0);
    setSiteAccessRevenueCount(0);
    setSiteAccessRevenueError("");

    return onSnapshot(
      collection(db, "siteAccess", accessSiteId, "transactions"),
      (snapshot) => {
        const validRecords = snapshot.docs
          .map((transaction) => transaction.data() as SiteAccessRevenueRecord)
          .filter(
            (transaction) =>
              transaction.currency === "PHP" &&
              Number.isSafeInteger(transaction.amountCentavos) &&
              (transaction.amountCentavos || 0) >= 0,
          );
        setSiteAccessRevenueCentavos(
          validRecords.reduce(
            (total, transaction) => total + (transaction.amountCentavos || 0),
            0,
          ),
        );
        setSiteAccessRevenueCount(validRecords.length);
        setSiteAccessRevenueLoading(false);
      },
      (error) => {
        console.error("Unable to load site access revenue records:", error);
        setSiteAccessRevenueError(
          getFirebaseErrorMessage(error, "Unable to load site access revenue."),
        );
        setSiteAccessRevenueLoading(false);
      },
    );
  }, [accessSiteId]);

  /* =====================
     ACTIONS
  ===================== */
  const handleUserActiveToggle = async (user: UserType) => {
    if (user.role === "superadmin" && currentRole !== "superadmin") {
      alert("Only a super admin can change a super-admin account's status.");
      return;
    }
    const isActive = user.status === "Active";
    const nextStatus = isActive ? "Deactivated" : "Active";
    if (!window.confirm(`${isActive ? "Deactivate" : "Reactivate"} ${user.name}?`))
      return;
    try {
      await updateDoc(doc(db, "users", user.id), { status: nextStatus });
    } catch (error) {
      console.error("Unable to update user status:", error);
      alert(getFirebaseErrorMessage(error, "Unable to update this user's status. Try again."));
      return;
    }
    setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, status: nextStatus } : item));
    try {
      await writeAuditLog({
        actorId: authUser?.uid,
        actorRole: currentRole,
        action: `user.${isActive ? "deactivated" : "reactivated"}`,
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email, institutionId: user.institutionId || null },
        throwOnFailure: true,
      });
    } catch (error) {
      console.error("User status was updated, but its audit record could not be written:", error);
      alert("User status was updated, but its activity record could not be written.");
    }
  };

  const handleResendSetupLink = async (user: UserType) => {
    setResendingSetupLinkFor(user.id);
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert(`A password setup link was sent to ${user.email}.`);
    } catch (error) {
      console.error("Unable to send account setup email:", error);
      alert(getFirebaseErrorMessage(error, "Unable to send the setup email. Please try again."));
    } finally {
      setResendingSetupLinkFor("");
    }
  };

  const handleToggleInstitutionActive = async (institution: Institution) => {
    const isActive = !isInstitutionActive(institution);
    const action = isActive ? "reactivate" : "deactivate";
    if (!window.confirm(`${isActive ? "Reactivate" : "Deactivate"} ${institution.name}? Its content and analytics will be preserved, but deactivated institutions will no longer be available in the live map or institution portal.`)) return;
    try {
      await setInstitutionActive(institution.id, isActive);
      setInstitutions((prev) => prev.map((item) =>
        item.id === institution.id ? { ...item, isActive } : item,
      ));
    } catch (error) {
      console.error(`Unable to ${action} institution:`, error);
      alert(
        getFirebaseErrorMessage(error, `Unable to ${action} this institution. Please try again.`),
      );
      return;
    }

    try {
      await writeAuditLog({
        actorId: authUser?.uid,
        actorRole: currentRole,
        action: `institution.${isActive ? "reactivated" : "deactivated"}`,
        entityType: "institution",
        entityId: institution.id,
        throwOnFailure: true,
      });
    } catch (error) {
      console.error(`Institution ${action} succeeded, but its audit record could not be written:`, error);
      alert(`Institution ${action} succeeded, but its activity record could not be written.`);
    }
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
    setInstitutionFormError("");
  };

  const handleInstSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as any;
    const rawDayPassPrice = String(form.dayPassPrice.value).trim();
    const dayPassPrice = rawDayPassPrice === "" ? null : Number(rawDayPassPrice);
    if (
      dayPassPrice !== null &&
      (!Number.isFinite(dayPassPrice) ||
        dayPassPrice < 0 ||
        !/^\d+(\.\d{1,2})?$/.test(rawDayPassPrice) ||
        !Number.isSafeInteger(Math.round(dayPassPrice * 100)))
    ) {
      setInstitutionFormError("Enter a valid day-pass price with up to two decimal places.");
      return;
    }

    const data = {
      name: form.name.value.trim(),
      location: form.location.value.trim(),
      curator: form.curator.value.trim(),
      joined: currentInst?.joined || new Date().toISOString().split("T")[0],
      requiresPaidAccess: form.requiresPaidAccess.checked,
      dayPassPriceCentavos:
        dayPassPrice === null ? null : Math.round(dayPassPrice * 100),
    };

    if (!data.name || !data.location || !data.curator) {
      setInstitutionFormError("Enter the institution name, location, and head curator.");
      return;
    }

    const isNewInstitution = !currentInst;
    const accountEmail = isNewInstitution ? String(form.accountEmail?.value || "").trim() : "";
    if (isNewInstitution && !accountEmail) {
      setInstitutionFormError("Enter a curator account email so a password setup link can be sent.");
      return;
    }

    setSavingInstitution(true);
    setInstitutionFormError("");
    let institutionId = currentInst?.id;

    try {
      if (currentInst) {
        await updateDoc(doc(db, "institutions", currentInst.id), data);
        setInstitutions((prev) =>
          prev.map((item) => (item.id === currentInst.id ? { ...item, ...data } : item)),
        );
      } else {
        const ref = await addDoc(collection(db, "institutions"), data);
        institutionId = ref.id;
        setInstitutions((prev) => [...prev, { id: ref.id, ...data, isActive: true }]);
      }
    } catch (error) {
      console.error("Unable to save institution:", error);
      setInstitutionFormError(
        getFirebaseErrorMessage(error, "Unable to save the institution. Check your connection and try again."),
      );
      setSavingInstitution(false);
      return;
    }

    const warnings: string[] = [];
    let createdAccountEmail = "";

    if (isNewInstitution && institutionId && accountEmail) {
      let createdAuthUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>["user"] | null = null;
      try {
        const tempPassword = generateTemporaryPassword();
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          accountEmail,
          tempPassword,
        );
        createdAuthUser = cred.user;

        try {
          await setDoc(doc(db, "users", cred.user.uid), {
            name: data.curator,
            email: accountEmail,
            role: "curator",
            institutionId,
            institutionIds: [institutionId],
            canPreviewUnpublishedSite: true,
            status: "Active",
            mustChangePassword: true,
            createdAt: serverTimestamp(),
          });
        } catch (profileError) {
          try {
            await deleteUser(cred.user);
          } catch (cleanupError) {
            console.error(
              "Institution account profile failed and Auth user cleanup failed:",
              cleanupError,
            );
          }
          throw profileError;
        }

        createdAccountEmail = accountEmail;
        setUsers((prev) => [
          ...prev,
          {
            id: cred.user.uid,
            name: data.curator,
            email: accountEmail,
            role: "curator",
            institutionId,
            institutionIds: [institutionId],
            canPreviewUnpublishedSite: true,
            status: "Active",
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
          },
        ]);

        try {
          await secondaryAuth.signOut();
        } catch (signOutError) {
          console.error("Secondary auth sign-out failed after creating institution account:", signOutError);
        }

        try {
          await writeAuditLog({
            actorId: authUser?.uid,
            actorRole: currentRole,
            action: "user.created",
            entityType: "user",
            entityId: cred.user.uid,
            metadata: {
              email: accountEmail,
              role: "curator",
              institutionId,
              institutionIds: [institutionId],
              canPreviewUnpublishedSite: true,
              provisionedWithInstitution: true,
            },
            throwOnFailure: true,
          });
        } catch (userAuditError) {
          console.error("Institution account created, but user audit record failed:", userAuditError);
          warnings.push("The curator account was created, but its activity record could not be written.");
        }

        try {
          await sendPasswordResetEmail(auth, accountEmail);
        } catch (emailError) {
          console.error("Institution account created, but password email could not be sent:", emailError);
          warnings.push(
            `The curator account was created, but the password email could not be sent to ${accountEmail}. Use Resend password setup link in Users.`,
          );
        }
      } catch (accountError: any) {
        if (createdAuthUser) {
          try {
            await secondaryAuth.signOut();
          } catch {
            // Ignore sign-out cleanup error
          }
        }
        console.error("Institution saved, but automatic account creation failed:", accountError);
        warnings.push(
          `The institution was saved, but the account for ${accountEmail} could not be created: ${getFirebaseErrorMessage(accountError, "Create the user manually under Users.")}`,
        );
      }
    }

    setSavingInstitution(false);
    handleInstCloseModal();

    if (isNewInstitution && institutionId) {
      try {
        await syncGeneratedInstitutionTour(institutionId, authUser?.uid);
      } catch (error) {
        console.error("Institution was created, but its generated tour could not be created:", error);
        warnings.push("The institution was saved, but its tour could not be generated. Retry from User Management > Institutions.");
      }
    }

    try {
      await writeAuditLog({
        actorId: authUser?.uid,
        actorRole: currentRole,
        action: isNewInstitution ? "institution.created" : "institution.updated",
        entityType: "institution",
        entityId: institutionId || "",
        metadata: {
          ...data,
          ...(createdAccountEmail ? { accountEmail: createdAccountEmail } : {}),
        },
        throwOnFailure: true,
      });
    } catch (error) {
      console.error("Institution was saved, but its audit record could not be written:", error);
      warnings.push("The institution was saved, but its activity record could not be written.");
    }

    if (isNewInstitution && createdAccountEmail && warnings.length === 0) {
      alert(`Institution registered and curator account created. A password setup link was sent to ${createdAccountEmail}.`);
    } else if (warnings.length) {
      alert(warnings.join("\n"));
    }
  };

  const handleEdit = (user: UserType) => {
    if (user.role === "user") {
      return;
    }
    if (user.role === "superadmin" && currentRole !== "superadmin") {
      alert("Only a super admin can edit a super-admin account.");
      return;
    }
    const normalizedRole: UserAssignmentRole =
      user.role === "institution" ? "curator" : (user.role as UserAssignmentRole);
    setUserFormError("");
    setCurrentUser(user);
    setSelectedRole(normalizedRole);
    setSelectedInstitutionIds(getUserInstitutionIds(user));
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setUserFormError("");
    setCurrentUser(null);
    setSelectedRole("curator");
    setSelectedInstitutionIds([]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUser(null);
    setSelectedRole("curator");
    setSelectedInstitutionIds([]);
    setUserFormError("");
  };

  const toggleModelerInstitution = (instId: string) => {
    setSelectedInstitutionIds((prev) =>
      prev.includes(instId) ? prev.filter((id) => id !== instId) : [...prev, instId],
    );
  };

  /* =====================
     SAVE USER
  ===================== */
  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUserFormError("");
    const form = e.target as typeof e.target & {
      name: { value: string };
      email: { value: string };
      role: { value: UserAssignmentRole };
      institutionId?: { value: string };
    };

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const role = form.role.value as UserAssignmentRole;
    const isSuperAdmin = currentRole === "superadmin";
    const isAdminOrSuperAdmin = ["admin", "superadmin"].includes(currentRole || "");

    const normalizedInstitutionIds =
      role === "3d-modeler"
        ? [...new Set(selectedInstitutionIds.map((id) => String(id).trim()).filter(Boolean))]
        : role === "curator"
          ? (form.institutionId?.value ? [String(form.institutionId.value).trim()] : [])
          : [];
    const primaryInstitutionId = normalizedInstitutionIds[0] || null;
    const canPreviewUnpublishedSite = role === "curator" || role === "3d-modeler";

    if (role === "superadmin" && !isSuperAdmin) {
      setUserFormError("Only a super admin can assign or modify the superadmin role.");
      return;
    }
    if (currentUser?.role === "superadmin" && !isSuperAdmin) {
      setUserFormError("Only a super admin can edit a super-admin account.");
      return;
    }
    if (!isAdminOrSuperAdmin && currentUser && role !== currentUser.role) {
      setUserFormError("You do not have permission to change account roles.");
      return;
    }
    if (role === "curator" && !primaryInstitutionId) {
      setUserFormError("Select an institution for this curator account.");
      return;
    }
    if (role === "3d-modeler" && normalizedInstitutionIds.length === 0) {
      setUserFormError("Select at least one institution for this 3D modeler account.");
      return;
    }
    setLoading(true);

    try {
      if (currentUser) {
        const updatePayload: Record<string, unknown> = {
          name,
          email,
          role,
          institutionId: primaryInstitutionId,
          canPreviewUnpublishedSite,
          additionalRoles: deleteField(),
        };
        if (role === "3d-modeler") {
          updatePayload.institutionIds = normalizedInstitutionIds;
        } else if (role === "curator") {
          updatePayload.institutionIds = normalizedInstitutionIds;
        } else {
          updatePayload.institutionIds = deleteField();
        }

        await updateDoc(doc(db, "users", currentUser.id), updatePayload);

        setUsers((prev) =>
          prev.map((u) =>
            u.id === currentUser.id
              ? {
                  ...u,
                  name,
                  email,
                  role,
                  institutionId: primaryInstitutionId,
                  institutionIds:
                    role === "curator" || role === "3d-modeler"
                      ? normalizedInstitutionIds
                      : undefined,
                  canPreviewUnpublishedSite,
                }
              : u,
          ),
        );
        const warnings: string[] = [];
        try {
          await writeAuditLog({
            actorId: authUser?.uid,
            actorRole: currentRole,
            action: "user.updated",
            entityType: "user",
            entityId: currentUser.id,
            metadata: {
              email,
              role,
              institutionId: primaryInstitutionId,
              institutionIds: normalizedInstitutionIds,
              canPreviewUnpublishedSite,
            },
            throwOnFailure: true,
          });
        } catch (auditError) {
          console.error("User was updated, but its audit record could not be saved:", auditError);
          warnings.push("The user was updated, but its activity record could not be saved.");
        }
        handleCloseModal();
        if (warnings.length) window.alert(warnings.join("\n"));
      } else {
        const tempPassword = generateTemporaryPassword();
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          tempPassword,
        );

        const newUserDoc: Record<string, unknown> = {
          name,
          email,
          role,
          institutionId: primaryInstitutionId,
          canPreviewUnpublishedSite,
          status: "Active",
          mustChangePassword: false,
          createdAt: serverTimestamp(),
        };
        if (role === "curator" || role === "3d-modeler") {
          newUserDoc.institutionIds = normalizedInstitutionIds;
        }

        try {
          await setDoc(doc(db, "users", cred.user.uid), newUserDoc);
        } catch (profileError) {
          try {
            await deleteUser(cred.user);
          } catch (cleanupError) {
            console.error(
              "User profile creation failed and the new Firebase Auth account could not be removed:",
              cleanupError,
            );
            setUserFormError(
              `The Firebase account was created, but its profile could not be saved and automatic cleanup failed. Contact an administrator with user ID ${cred.user.uid}.`,
            );
            return;
          }
          throw profileError;
        }

        setUsers((prev) => [
          ...prev,
          {
            id: cred.user.uid,
            name,
            email,
            role,
            institutionId: primaryInstitutionId,
            institutionIds:
              role === "curator" || role === "3d-modeler"
                ? normalizedInstitutionIds
                : undefined,
            canPreviewUnpublishedSite,
            status: "Active",
            mustChangePassword: false,
            createdAt: new Date().toISOString(),
          },
        ]);

        const warnings: string[] = [];
        try {
          await secondaryAuth.signOut();
        } catch (signOutError) {
          console.error("The new account was saved, but secondary authentication could not sign out:", signOutError);
          warnings.push("The new account was saved, but the account-creation session could not be cleared.");
        }
        try {
          await writeAuditLog({
            actorId: authUser?.uid,
            actorRole: currentRole,
            action: "user.created",
            entityType: "user",
            entityId: cred.user.uid,
            metadata: {
              email,
              role,
              institutionId: primaryInstitutionId,
              institutionIds: normalizedInstitutionIds,
              canPreviewUnpublishedSite,
            },
            throwOnFailure: true,
          });
        } catch (auditError) {
          console.error("User was created, but its audit record could not be saved:", auditError);
          warnings.push("The user was created, but its activity record could not be saved.");
        }
        let setupEmailSent = true;
        try {
          await sendPasswordResetEmail(auth, email);
        } catch (setupEmailError) {
          console.error("User was created, but the password setup email could not be sent:", setupEmailError);
          setupEmailSent = false;
          warnings.push("The account was created, but its setup email could not be sent. Use the resend setup link action.");
        }

        handleCloseModal();
        alert(
          `User created successfully.${setupEmailSent ? ` A password setup link was sent to ${email}.` : ""}${warnings.length ? `\n\nWarnings:\n${warnings.join("\n")}` : ""}`,
        );
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setUserFormError(
        getFirebaseErrorMessage(err, "Unable to save the user. Check the form and try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSiteAccessStatusChange = async (
    user: UserType,
    durationMs: number | null,
  ) => {
    const site = accessSite;
    if (user.role !== "user" || !site?.requiresPaidAccess) return;
    const dayPassPriceCentavos =
      typeof site.dayPassPriceCentavos === "number" &&
      Number.isSafeInteger(site.dayPassPriceCentavos)
        ? site.dayPassPriceCentavos
        : null;
    if (
      durationMs === DEFAULT_SITE_ACCESS_DURATION_MS &&
      dayPassPriceCentavos === null
    ) {
      setSiteAccessError("Set this institution's day-pass price before granting a day pass.");
      return;
    }

    setSiteAccessSavingUserId(user.id);
    setSiteAccessError("");
    const status = durationMs === null ? "inactive" : "paid";
    const expiresAt = durationMs === null
      ? null
      : Timestamp.fromDate(new Date(Date.now() + durationMs));

    try {
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, "siteAccess", site.id, "users", user.id),
          {
            userId: user.id,
            institutionId: site.id,
            status,
            demo: true,
            updatedAt: serverTimestamp(),
            updatedBy: authUser?.uid,
            ...(durationMs === null
              ? { expiresAt: deleteField(), durationMs: deleteField() }
              : {
                  paidAt: serverTimestamp(),
                  expiresAt,
                  durationMs,
                  expiredAt: deleteField(),
                }),
          },
          { merge: true },
        );
        if (
          durationMs === DEFAULT_SITE_ACCESS_DURATION_MS &&
          dayPassPriceCentavos !== null
        ) {
          batch.set(doc(collection(db, "siteAccess", site.id, "transactions")), {
            institutionId: site.id,
            userId: user.id,
            type: "admin_day_pass",
            source: "admin",
            amountCentavos: dayPassPriceCentavos,
            currency: "PHP",
            durationMs,
            createdAt: serverTimestamp(),
            createdBy: authUser?.uid || null,
          });
        }
        await batch.commit();
        setSiteAccessByUser((current) => ({
          ...current,
          [user.id]: {
            ...current[user.id],
            userId: user.id,
            institutionId: site.id,
            status,
            ...(durationMs === null
              ? { expiresAt: undefined, durationMs: undefined }
              : { expiresAt, durationMs }),
          },
        }));
      } catch (error) {
        console.error("Unable to update user site access:", error);
        setSiteAccessError(
          getFirebaseErrorMessage(error, "Unable to update this user's site access."),
        );
        return;
      }

      await writeAuditLog({
        actorId: authUser?.uid,
        actorRole: currentRole,
        action: `site-access.${status === "paid" ? "demo-pass-granted" : "pass-revoked"}`,
        entityType: "site-access",
        entityId: `${site.id}/${user.id}`,
        metadata: {
          institutionId: site.id,
          status,
          expiresAt,
          durationMs,
          ...(durationMs === DEFAULT_SITE_ACCESS_DURATION_MS
            ? {
                amountCentavos: dayPassPriceCentavos,
                currency: "PHP",
              }
            : {}),
        },
      });
    } catch (auditError) {
      console.error("Site access was updated, but its audit record could not be written:", auditError);
      setSiteAccessError("Site access was updated, but its activity record could not be written.");
    } finally {
      setSiteAccessSavingUserId("");
    }
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

  const availableRoles: UserAssignmentRole[] =
    currentRole === "superadmin"
      ? currentUser?.role === "superadmin"
        ? ["superadmin"]
        : ["admin", "curator", "3d-modeler"]
      : currentUser?.role === "superadmin"
        ? ["superadmin"]
        : ["admin", "curator", "3d-modeler"];

  /* =====================
     UI
  ===================== */
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        description="Manage user accounts, role assignments, and institution access."
      />
      <div className={tableStyles.tableContainer}>
      {pageLoadError && (
        <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>
          {pageLoadError}
        </div>
      )}
      {readinessLoadError && activeTab === "institutions" && (
        <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>
          {readinessLoadError}
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`${tableStyles.tabBtn} ${activeTab === "users" ? tableStyles.active : ""}`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("institutions")}
          className={`${tableStyles.tabBtn} ${activeTab === "institutions" ? tableStyles.active : ""}`}
        >
          Institutions
        </button>
      </div>

      {activeTab === "users" ? (
        <>
          {siteAccessError && (
            <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>
              {siteAccessError}
            </div>
          )}
          <div className={tableStyles.controls}>
            <input
              type="text"
              className={tableStyles.searchBar}
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className={commonStyles.formControl}
              aria-label="Site for phone-user access status"
              value={accessSiteId}
              onChange={(event) => setAccessSiteId(event.target.value)}
              style={{ maxWidth: "280px" }}
            >
              {institutions.length === 0 && (
                <option value="">No sites available</option>
              )}
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
            <div
              role="status"
              style={{
                color: "#ddd",
                padding: "0.5rem 0.75rem",
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: 6,
                minWidth: 250,
              }}
            >
              <div>
                Day pass:{" "}
                {Number.isSafeInteger(accessSite?.dayPassPriceCentavos)
                  ? formatPhp(accessSite?.dayPassPriceCentavos || 0)
                  : "Price not configured"}
              </div>
              <div>
                Recorded revenue:{" "}
                {siteAccessRevenueLoading
                  ? "Loading..."
                  : `${formatPhp(siteAccessRevenueCentavos)} (${siteAccessRevenueCount} pass${siteAccessRevenueCount === 1 ? "" : "es"})`}
              </div>
              {siteAccessRevenueError && (
                <div role="alert" style={{ color: "#fca5a5" }}>
                  {siteAccessRevenueError}
                </div>
              )}
              <small style={{ color: "#a8a29e" }}>
                Admin-granted day passes count at the saved price; one-minute tests are excluded. Phone purchases are not included yet.
              </small>
            </div>
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
                <th>Unpublished Preview</th>
                <th>Email</th>
                <th>Status</th>
                <th>Site Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length ? (
                filteredUsers.map((user) => {
                  const userInstIds = getUserInstitutionIds(user);
                  const assignedInstitutionNames = userInstIds
                    .map((id) => institutions.find((i) => i.id === id)?.name)
                    .filter(Boolean);
                  return (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 500, color: "#fff" }}>{user.name}</td>
                      <td>
                        {["institution", "curator"].includes(user.role)
                          ? "Curator"
                          : user.role === "3d-modeler"
                            ? "3D modeler"
                            : user.role}
                      </td>
                      <td>
                        {["institution", "curator", "3d-modeler"].includes(user.role)
                          ? assignedInstitutionNames.length > 0
                            ? assignedInstitutionNames.join(", ")
                            : "—"
                          : "—"}
                      </td>
                      <td>{hasUnpublishedSitePreview(user) ? "Enabled for assigned site" : "—"}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          style={{
                            color: user.status === "Active" ? "#4ade80" : "#ef4444",
                          }}
                        >
                          {getUserStatusLabel(user.status)}
                        </span>
                      </td>
                      <td>
                        {user.role !== "user" ? (
                          "—"
                        ) : !accessSiteId ? (
                          "Select a site"
                        ) : siteAccessLoading ? (
                          "Loading..."
                        ) : !institutions.find((institution) => institution.id === accessSiteId)
                            ?.requiresPaidAccess ? (
                          "Not required"
                        ) : (
                          <>
                            <select
                              className={commonStyles.formControl}
                              aria-label={`Site access for ${user.name}`}
                              value={
                                isSiteAccessPaid(siteAccessByUser[user.id], siteAccessNow)
                                  ? typeof siteAccessByUser[user.id]?.durationMs === "number"
                                    ? String(siteAccessByUser[user.id].durationMs)
                                    : "legacy"
                                  : "inactive"
                              }
                              onChange={(event) => handleSiteAccessStatusChange(
                                user,
                                event.target.value === "inactive"
                                  ? null
                                  : Number(event.target.value),
                              )}
                              disabled={siteAccessSavingUserId === user.id}
                            >
                              <option value="inactive">Inactive</option>
                              {isSiteAccessPaid(siteAccessByUser[user.id], siteAccessNow) &&
                                typeof siteAccessByUser[user.id]?.durationMs === "number" &&
                                !siteAccessDurationOptions.some(
                                  (option) =>
                                    option.durationMs === siteAccessByUser[user.id]?.durationMs,
                                ) && (
                                  <option
                                    value={String(siteAccessByUser[user.id]?.durationMs)}
                                    disabled
                                  >
                                    Existing pass (
                                    {formatAccessDuration(siteAccessByUser[user.id]?.durationMs || 0)})
                                  </option>
                                )}
                              {isSiteAccessPaid(siteAccessByUser[user.id], siteAccessNow) &&
                                typeof siteAccessByUser[user.id]?.durationMs !== "number" && (
                                  <option value="legacy" disabled>Current paid pass</option>
                                )}
                              {siteAccessDurationOptions.map((option) => {
                                const dayPriceConfigured =
                                  Number.isSafeInteger(accessSite?.dayPassPriceCentavos);
                                const isDayPass =
                                  option.durationMs === DEFAULT_SITE_ACCESS_DURATION_MS;
                                return (
                                  <option
                                    key={option.durationMs}
                                    value={option.durationMs}
                                    disabled={isDayPass && !dayPriceConfigured}
                                  >
                                    {isDayPass && dayPriceConfigured
                                      ? `${option.label} (${formatPhp(accessSite?.dayPassPriceCentavos || 0)})`
                                      : option.label}
                                  </option>
                                );
                              })}
                            </select>
                            {["paid", "expired"].includes(siteAccessByUser[user.id]?.status || "") && (
                              <small style={{ display: "block", marginTop: "0.35rem" }}>
                                {siteAccessByUser[user.id]?.status === "expired" ||
                                !isSiteAccessPaid(siteAccessByUser[user.id], siteAccessNow)
                                  ? `Expired ${formatUserDate(siteAccessByUser[user.id]?.expiresAt)}`
                                  : `Expires ${formatUserDate(siteAccessByUser[user.id]?.expiresAt)}`}
                              </small>
                            )}
                          </>
                        )}
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
                          title="Resend password setup link"
                          aria-label={`Resend password setup link to ${user.email}`}
                          disabled={resendingSetupLinkFor === user.id}
                          onClick={() => handleResendSetupLink(user)}
                        >
                          <i className={`fa-solid ${resendingSetupLinkFor === user.id ? "fa-spinner fa-spin" : "fa-envelope"}`}></i>
                        </button>
                        <button
                          className={tableStyles.btnAction}
                          title={user.role === "user" ? "App user accounts cannot be edited here" : "Edit"}
                          disabled={user.role === "user" || (user.role === "superadmin" && currentRole !== "superadmin")}
                          onClick={() => handleEdit(user)}
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          className={tableStyles.btnAction}
                          title={user.status === "Active" ? "Deactivate account" : "Reactivate account"}
                          style={{ borderColor: user.status === "Active" ? "#ef4444" : "#4ade80", color: user.status === "Active" ? "#ef4444" : "#4ade80" }}
                          disabled={user.role === "superadmin" && currentRole !== "superadmin"}
                          onClick={() => handleUserActiveToggle(user)}
                        >
                          <i className={`fa-solid ${user.status === "Active" ? "fa-user-slash" : "fa-user-check"}`}></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
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
                  <div>
                    <small style={{ color: "#999" }}>Role</small>
                    <p>
                      {["institution", "curator"].includes(detailsUser.role)
                        ? "Curator"
                        : detailsUser.role === "3d-modeler"
                          ? "3D modeler"
                          : detailsUser.role || "-"}
                    </p>
                  </div>
                  <div>
                    <small style={{ color: "#999" }}>Unpublished site preview</small>
                    <p>{hasUnpublishedSitePreview(detailsUser) ? "Enabled for assigned site" : "Not enabled"}</p>
                  </div>
                  <div><small style={{ color: "#999" }}>Status</small><p>{getUserStatusLabel(detailsUser.status)}</p></div>
                  <div>
                    <small style={{ color: "#999" }}>Institution(s)</small>
                    <p>
                      {getUserInstitutionIds(detailsUser)
                        .map((id) => institutions.find((item) => item.id === id)?.name)
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </p>
                  </div>
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
                <button className={commonStyles.btnCancel} onClick={handleCloseModal} disabled={loading}>Cancel</button>
                <button type="submit" form="userForm" className={commonStyles.btnUpdate} disabled={loading}>
                  {currentUser ? "Update User" : "Add User"}
                </button>
              </>
            }
          >
            <form id="userForm" onSubmit={handleSave}>
              {userFormError && (
                <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>
                  {userFormError}
                </div>
              )}
              <div className={commonStyles.formGroup}>
                <label>Name</label>
                <input type="text" name="name" className={commonStyles.formControl} defaultValue={currentUser?.name} required />
              </div>

              <div className={commonStyles.formGroup}>
                <label>Email Address</label>
                <input type="email" name="email" className={commonStyles.formControl} defaultValue={currentUser?.email} required />
              </div>

              <div className={commonStyles.formGroup}>
                <label>Role</label>
                <select
                  name="role"
                  className={commonStyles.formControl}
                  value={selectedRole}
                  onChange={(event) => {
                    const nextRole = event.target.value as UserAssignmentRole;
                    setSelectedRole(nextRole);
                    if (nextRole !== "3d-modeler") {
                      setSelectedInstitutionIds((prev) => prev.slice(0, 1));
                    }
                  }}
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r === "curator"
                        ? "Curator"
                        : r === "3d-modeler"
                          ? "3D modeler"
                          : r}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRole === "curator" && (
                <div className={commonStyles.formGroup}>
                  <label>Institution</label>
                  <select
                    name="institutionId"
                    className={commonStyles.formControl}
                    defaultValue={currentUser?.institutionId || ""}
                  >
                    <option value="">Select institution</option>
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedRole === "3d-modeler" && (
                <div className={commonStyles.formGroup}>
                  <label>Assigned Institutions (select one or more)</label>
                  <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.4rem" }}>
                    {institutions.map((i) => {
                      const checked = selectedInstitutionIds.includes(i.id);
                      return (
                        <label
                          key={i.id}
                          style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleModelerInstitution(i.id)}
                          />
                          <span>{i.name}</span>
                        </label>
                      );
                    })}
                  </div>
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
                <th>Status</th>
                <th>Site readiness</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstitutions.length > 0 ? (
                filteredInstitutions.map((inst) => {
                  const readiness = getInstitutionContentReadiness(
                    contentItems.filter((item) => item.institutionId === inst.id),
                  );
                  return (
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
                      <td>{isInstitutionActive(inst) ? "Active" : "Inactive"}</td>
                      <td>
                        <strong style={{ color: readiness.isReady ? "#4ade80" : "#fbbf24" }}>
                          {readiness.isReady ? "Ready" : "Setup incomplete"}
                        </strong>
                        {!readiness.isReady && (
                          <small style={{ display: "block", color: "#a8a29e", marginTop: 4 }}>
                            Needs {readiness.missing.join(" and ")}
                          </small>
                        )}
                      </td>
                      <td>
                        <button className={tableStyles.btnAction} title="Edit" onClick={() => handleInstEdit(inst)}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className={tableStyles.btnAction} title={isInstitutionActive(inst) ? "Deactivate" : "Reactivate"} style={{ borderColor: isInstitutionActive(inst) ? "#ef4444" : "#4ade80", color: isInstitutionActive(inst) ? "#ef4444" : "#4ade80" }} onClick={() => handleToggleInstitutionActive(inst)}>
                          <i className={`fa-solid ${isInstitutionActive(inst) ? "fa-ban" : "fa-circle-check"}`}></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>No institutions found</td>
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
                <button className={commonStyles.btnCancel} onClick={handleInstCloseModal} disabled={savingInstitution}>Cancel</button>
                <button type="submit" form="instForm" className={commonStyles.btnUpdate} disabled={savingInstitution}>{savingInstitution ? "Saving..." : currentInst ? "Update" : "Register"}</button>
              </>
            }
          >
            <form id="instForm" onSubmit={handleInstSave}>
              {institutionFormError && (
                <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>
                  {institutionFormError}
                </div>
              )}
              {!currentInst && (
                <p style={{ color: "#a8a29e", marginTop: 0 }}>
                  After registration, the site is marked incomplete until it has one quality-ready, Published Information item and one quality-ready, Published VR model. Staff can sign in and complete setup meanwhile.
                </p>
              )}
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

              {!currentInst && (
                <div className={commonStyles.formGroup}>
                  <label htmlFor="institution-account-email">Curator Account Email</label>
                  <input
                    id="institution-account-email"
                    name="accountEmail"
                    type="email"
                    className={commonStyles.formControl}
                    placeholder="curator@institution.org"
                    required
                  />
                  <small style={{ color: "#a8a29e" }}>
                    A curator account linked to this institution will be created automatically and a password setup link will be sent to this email.
                  </small>
                </div>
              )}

              <div className={commonStyles.formGroup}>
                <label htmlFor="institution-day-pass-price">24-hour pass price (PHP)</label>
                <input
                  id="institution-day-pass-price"
                  name="dayPassPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className={commonStyles.formControl}
                  defaultValue={
                    currentInst?.dayPassPriceCentavos == null
                      ? ""
                      : (currentInst.dayPassPriceCentavos / 100).toFixed(2)
                  }
                  placeholder="e.g. 50.00"
                />
                <small style={{ color: "#a8a29e" }}>
                  Leave blank until the site price is configured. Fort San Pedro can be set to ₱50.00.
                </small>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  type="checkbox"
                  name="requiresPaidAccess"
                  defaultChecked={currentInst?.requiresPaidAccess === true}
                />
                Require a paid pass in the phone app (demo)
              </label>
            </form>
          </Modal>
        </>
      )}
      </div>
    </>
  );
};

export default UserManagement;