import React, { useEffect, useState } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { getRatingStats, loadFeedback, loadUserAnalytics } from "../../lib/userAnalytics";
import dashboardStyles from '../../components/features/dashboard/Dashboard.module.css';

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
        byType: {},
        feedback: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDashboard = async () => {
            if (!currentUser) return;
            try {
                const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
                const institutionId = profileSnap.data()?.institutionId;
                if (!institutionId) {
                    setError("No institution is linked to this account.");
                    return;
                }

                const [institutionSnap, contentSnap, landmarkSnap, poiSnap, analyticsRows, feedbackRows] = await Promise.all([
                    getDoc(doc(db, "institutions", institutionId)),
                    getDocs(query(collection(db, "content"), where("institutionId", "==", institutionId))),
                    getDocs(query(collection(db, "markers"), where("institutionId", "==", institutionId))),
                    getDocs(query(collection(db, "pois"), where("institutionId", "==", institutionId))),
                    loadUserAnalytics(institutionId),
                    loadFeedback(institutionId),
                ]);
                const byType = contentSnap.docs.reduce((counts, item) => {
                    const type = item.data().type || "Other";
                    counts[type] = (counts[type] || 0) + 1;
                    return counts;
                }, {});

                setDashboard({
                    institution: institutionSnap.exists() ? institutionSnap.data() : null,
                    content: contentSnap.size,
                    published: contentSnap.docs.filter((item) => item.data().status === "Published").length,
                    landmarks: landmarkSnap.size,
                    pois: poiSnap.size,
                    interactions: analyticsRows.reduce((total, item) => total + Number(item.interactionCount || 0), 0),
                    byType,
                    feedback: feedbackRows,
                });
            } catch (loadError) {
                console.error("Unable to load institution dashboard:", loadError);
                setError("Unable to load live dashboard data.");
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [currentUser]);

    if (loading) return <div className={dashboardStyles.dashboardState}>Loading your institution dashboard...</div>;
    if (error) return <div className={dashboardStyles.dashboardState}>{error}</div>;

    const ratingStats = getRatingStats(dashboard.feedback);
    const contentTypes = ["Information", "Quiz", "3D Model", "Other"];
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

    return (
        <div className={dashboardStyles.institutionDashboard}>
            <section className={dashboardStyles.dashboardIntro}>
                <div>
                    <p className={dashboardStyles.eyebrow}>Institution overview</p>
                    <h1>{institutionName}</h1>
                    <p className={dashboardStyles.introMeta}>{dashboard.institution?.location || "Institution workspace"}</p>
                </div>
                <div className={dashboardStyles.institutionMeta}>
                    <span><i className="fa-solid fa-user-tie"></i> Curated by</span>
                    <strong>{dashboard.institution?.curator || "Institution team"}</strong>
                </div>
            </section>

            <section className={dashboardStyles.statsGrid}>
                {[
                    ["Content items", dashboard.content, "fa-layer-group"],
                    ["Published", dashboard.published, "fa-circle-check"],
                    ["Landmarks", dashboard.landmarks, "fa-landmark"],
                    ["POIs", dashboard.pois, "fa-location-dot"],
                    ["User interactions", dashboard.interactions, "fa-hand-pointer"],
                    ["Average rating", ratingStats.average === null ? "-" : `${ratingStats.average.toFixed(1)} / 5`, "fa-star"],
                ].map(([label, value, icon]) => (
                    <div className={dashboardStyles.statCard} key={label}>
                        <div className={dashboardStyles.statIcon}><i className={`fa-solid ${icon}`}></i></div>
                        <div className={dashboardStyles.statInfo}><h3>{label}</h3><div className={dashboardStyles.value}>{value}</div></div>
                    </div>
                ))}
            </section>

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
                {dashboard.feedback.length === 0 ? <p className={dashboardStyles.emptyState}>No feedback has been submitted yet.</p> : dashboard.feedback.slice(0, 4).map((item) => <div className={dashboardStyles.feedbackItem} key={item.id}><span className={dashboardStyles.feedbackRating}><i className="fa-solid fa-star"></i> {item.rating || "-"}</span><p>{item.comment || "Rated without a comment"}</p></div>)}
            </section>
        </div>
    );
};

export default InstituteDashboard;
