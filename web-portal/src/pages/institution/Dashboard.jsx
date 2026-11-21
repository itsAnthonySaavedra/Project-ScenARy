import React, { useEffect, useState } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { cleanFeedbackComment, getRatingStats, loadFeedback } from "../../lib/userAnalytics";
import { MODEL_CONTENT_TYPE, normalizeContentType } from "../../lib/contentTypes";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import dashboardStyles from '../../components/features/dashboard/Dashboard.module.css';
import SetupFlowBanner from "../../components/common/SetupFlowBanner";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);


const InstituteDashboard = () => {
    const { currentUser } = useAuth();
    const [dashboard, setDashboard] = useState({
        institution: null,
        content: 0,
        published: 0,
        landmarks: 0,
        pois: 0,
        interactions: 0,
        revenueCentavos: 0,
        revenueCount: 0,
        byType: {},
        feedback: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [warning, setWarning] = useState("");
    const [revenueLoading, setRevenueLoading] = useState(true);
    const [revenueError, setRevenueError] = useState("");

    useEffect(() => {
        let active = true;
        const unsubscribers = [];
        const loadedSources = new Set();
        const markLoaded = (source) => {
            loadedSources.add(source);
            if (loadedSources.size === 5) setLoading(false);
        };
        const handleSnapshotError = (snapshotError) => {
            console.error("Unable to receive institution dashboard updates:", snapshotError);
            setError(
                getFirebaseErrorMessage(snapshotError, "Unable to load live dashboard data. Reload and try again."),
            );
            setLoading(false);
        };

        const loadDashboard = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }
            try {
                const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
                if (!active) return;
                const institutionId = profileSnap.data()?.institutionId;
                if (!institutionId) {
                    setError("No institution is linked to this account.");
                    setLoading(false);
                    return;
                }

                const institutionRef = doc(db, "institutions", institutionId);
                const contentQuery = query(collection(db, "content"), where("institutionId", "==", institutionId));
                const landmarkQuery = query(collection(db, "landmarks"), where("institutionId", "==", institutionId));
                const poiQuery = query(collection(db, "pois"), where("institutionId", "==", institutionId));
                const analyticsQuery = query(collection(db, "userAnalytics"), where("institutionId", "==", institutionId));
                const siteAccessTransactions = collection(db, "siteAccess", institutionId, "transactions");

                setRevenueLoading(true);
                unsubscribers.push(
                    onSnapshot(institutionRef, (snapshot) => {
                        setDashboard((current) => ({ ...current, institution: snapshot.exists() ? snapshot.data() : null }));
                        markLoaded("institution");
                    }, handleSnapshotError),
                    onSnapshot(contentQuery, (snapshot) => {
                        const byType = snapshot.docs.reduce((counts, item) => {
                            const type = normalizeContentType(item.data().type || "Other");
                            counts[type] = (counts[type] || 0) + 1;
                            return counts;
                        }, {});
                        setDashboard((current) => ({
                            ...current,
                            content: snapshot.size,
                            published: snapshot.docs.filter((item) => item.data().status === "Published").length,
                            byType,
                        }));
                        markLoaded("content");
                    }, handleSnapshotError),
                    onSnapshot(landmarkQuery, (snapshot) => {
                        setDashboard((current) => ({ ...current, landmarks: snapshot.size }));
                        markLoaded("landmarks");
                    }, handleSnapshotError),
                    onSnapshot(poiQuery, (snapshot) => {
                        setDashboard((current) => ({ ...current, pois: snapshot.size }));
                        markLoaded("pois");
                    }, handleSnapshotError),
                    onSnapshot(analyticsQuery, (snapshot) => {
                        const interactions = snapshot.docs.reduce((total, item) => total + Number(item.data().interactionCount || 0), 0);
                        setDashboard((current) => ({ ...current, interactions }));
                        markLoaded("analytics");
                    }, handleSnapshotError),
                    onSnapshot(siteAccessTransactions, (snapshot) => {
                        const transactions = snapshot.docs
                            .map((item) => item.data())
                            .filter(
                                (item) =>
                                    item.currency === "PHP" &&
                                    Number.isSafeInteger(item.amountCentavos) &&
                                    item.amountCentavos >= 0,
                            );
                        const revenueCentavos = transactions.reduce(
                            (total, item) => total + item.amountCentavos,
                            0,
                        );
                        setDashboard((current) => ({
                            ...current,
                            revenueCentavos,
                            revenueCount: transactions.length,
                        }));
                        setRevenueError("");
                        setRevenueLoading(false);
                    }, (revenueSnapshotError) => {
                        console.error("Unable to receive institution site revenue:", revenueSnapshotError);
                        setRevenueError(
                            getFirebaseErrorMessage(
                                revenueSnapshotError,
                                "Unable to load site revenue.",
                            ),
                        );
                        setRevenueLoading(false);
                    }),
                );

                loadFeedback(institutionId)
                    .then((feedback) => {
                        if (active) setDashboard((current) => ({ ...current, feedback }));
                    })
                    .catch((feedbackError) => {
                        console.error("Unable to load institution dashboard feedback:", feedbackError);
                        if (active) {
                            setWarning(
                                getFirebaseErrorMessage(feedbackError, "Feedback could not be loaded. Other dashboard data remains available."),
                            );
                        }
                    });
            } catch (loadError) {
                console.error("Unable to load institution dashboard:", loadError);
                setError(
                    getFirebaseErrorMessage(loadError, "Unable to load live dashboard data. Reload and try again."),
                );
                setLoading(false);
            }
        };

        loadDashboard();
        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [currentUser]);

    if (loading) return <div className={dashboardStyles.dashboardState}>Loading your institution dashboard...</div>;
    if (error) {
        return (
            <div className={dashboardStyles.dashboardState} role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => window.location.reload()}>Reload dashboard</button>
            </div>
        );
    }

    const ratingStats = getRatingStats(dashboard.feedback);
    const contentTypes = ["Information", "Fun Fact", "Quiz", MODEL_CONTENT_TYPE, "Other"];
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
    const doughnutData = {
        labels: contentTypes,
        datasets: [{ data: contentTypes.map((type) => dashboard.byType[type] || 0), backgroundColor: ["#d4af37", "#5f8f88", "#bb8066", "#756f69"], borderWidth: 0 }],
    };
    const inventoryData = {
        labels: ["Content", "Published", "Landmarks", "POIs", "Interactions"],
        datasets: [{ label: "Total", data: [dashboard.content, dashboard.published, dashboard.landmarks, dashboard.pois, dashboard.interactions], backgroundColor: ["#d4af37", "#e0c875", "#5f8f88", "#bb8066", "#756f69"], borderRadius: 5, barThickness: 24 }],
    };
    const institutionName = dashboard.institution?.name || "Your institution";
    const revenueValue = revenueError
        ? "Unavailable"
        : revenueLoading
            ? "Loading..."
            : new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
            }).format(dashboard.revenueCentavos / 100);

    return (
        <div className={dashboardStyles.institutionDashboard}>
            <PageHeader
                eyebrow="Institution overview"
                title="Dashboard"
                description={`${institutionName} · ${dashboard.institution?.location || "Institution workspace"}`}
                actions={
                    <div className={dashboardStyles.institutionMeta}>
                    <span><i className="fa-solid fa-user-tie"></i> Curated by</span>
                    <strong>{dashboard.institution?.curator || "Institution team"}</strong>
                    </div>
                }
            />

            <SetupFlowBanner
  hasLandmarkPinAndInfo={dashboard.landmarks > 0}
  hasContentItems={dashboard.content > 0}
  hasLinkedLandmarkContent={dashboard.landmarks > 0 && dashboard.content > 0}
  hasPoiWithImageAndContent={dashboard.pois > 0 && dashboard.content > 0}
/>
{warning && <p role="status" style={{ color: "#fbbf24" }}>{warning}</p>}
            {warning && <p role="status" style={{ color: "#fbbf24" }}>{warning}</p>}

            <section className={dashboardStyles.statsGrid}>
                {[
                    ["Content items", dashboard.content, "fa-layer-group"],
                    ["Published", dashboard.published, "fa-circle-check"],
                    ["Landmarks", dashboard.landmarks, "fa-landmark"],
                    ["POIs", dashboard.pois, "fa-location-dot"],
                    ["User interactions", dashboard.interactions, "fa-hand-pointer"],
                    ["Average rating", ratingStats.average === null ? "-" : `${ratingStats.average.toFixed(1)} / 5`, "fa-star"],
                    [`Recorded pass revenue (${dashboard.revenueCount} passes)`, revenueValue, "fa-money-bill-wave"],
                ].map(([label, value, icon]) => (
                    <div className={dashboardStyles.statCard} key={label}>
                        <div className={dashboardStyles.statIcon} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <i className={`fa-solid ${icon}`} style={{ width: "auto", height: "auto" }}></i>
                        </div>
                        <div className={dashboardStyles.statInfo}><h3>{label}</h3><div className={dashboardStyles.value}>{value}</div></div>
                    </div>
                ))}
            </section>
            {revenueError ? (
                <p role="alert" style={{ color: "#fca5a5" }}>{revenueError}</p>
            ) : (
                <p style={{ color: "#a8a29e" }}>
                    Revenue includes admin-granted day passes recorded for your institution. One-minute tests and phone purchases are not included.
                </p>
            )}

            <section className={dashboardStyles.dashboardCharts}>
                <div className={dashboardStyles.chartCard}>
                    <div className={dashboardStyles.cardHeading}><div><p className={dashboardStyles.eyebrow}>Library health</p><h3>Content mix</h3></div><span>{dashboard.content} total</span></div>
                    <div className={dashboardStyles.chartContainer}><Doughnut data={doughnutData} options={{ ...chartOptions, cutout: "68%" }} /></div>
                    <div className={dashboardStyles.chartLegend}>{contentTypes.map((type) => <span key={type}><i className={dashboardStyles.legendDot}></i>{type}<strong>{dashboard.byType[type] || 0}</strong></span>)}</div>
                </div>
                <div className={dashboardStyles.chartCard}>
                    <div className={dashboardStyles.cardHeading}><div><p className={dashboardStyles.eyebrow}>Activity snapshot</p><h3>Reach across your space</h3></div><span>All time</span></div>
                    <div className={dashboardStyles.chartContainer}><Bar data={inventoryData} options={{ ...chartOptions, scales: { y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "#a8a29e" } }, x: { grid: { display: false }, ticks: { color: "#a8a29e" } } } }} /></div>
                </div>
            </section>

            <section className={dashboardStyles.feedbackCard}>
                <div className={dashboardStyles.cardHeading}><div><p className={dashboardStyles.eyebrow}>Visitor voice</p><h3>Recent feedback</h3></div><span>{dashboard.feedback.length} responses</span></div>
                {dashboard.feedback.length === 0 ? <p className={dashboardStyles.emptyState}>No feedback has been submitted yet.</p> : dashboard.feedback.slice(0, 4).map((item) => <div className={dashboardStyles.feedbackItem} key={item.id}><span className={dashboardStyles.feedbackRating}><i className="fa-solid fa-star"></i> {item.rating || "-"}</span><p>{cleanFeedbackComment(item.comment) || "Rated without a comment"}</p></div>)}
            </section>
        </div>
    );
};

export default InstituteDashboard;