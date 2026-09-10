import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Cached summary contract: users/{uid}/analytics/summary is represented here
// as a top-level userAnalytics/{uid} document for simple role-scoped queries.
export const loadUserAnalytics = async (institutionId = null) => {
  const analyticsQuery = institutionId
    ? query(collection(db, "userAnalytics"), where("institutionId", "==", institutionId))
    : query(collection(db, "userAnalytics"));
  const snapshot = await getDocs(analyticsQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const loadFeedback = async (institutionId = null) => {
  const feedbackQuery = institutionId
    ? query(collection(db, "feedback"), where("institutionId", "==", institutionId))
    : query(collection(db, "feedback"));
  const snapshot = await getDocs(feedbackQuery);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt));
};

export const removeFeedback = async (feedbackId) => {
  await deleteDoc(doc(db, "feedback", feedbackId));
};

const timestampValue = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const toRating = (summary) => Number(summary.ratingTotal || 0);

export const getUserAnalyticsMetrics = (summary) => {
  const ratingCount = Number(summary.ratingCount || 0);
  const quizAttempts = Number(summary.quizAttempts || 0);
  const sessionCount = Number(summary.sessionCount || 0);
  const clickCount = Number(summary.clickCount ?? summary.interactionCount ?? 0);
  const totalSessionDurationSeconds = Number(summary.totalSessionDurationSeconds || 0);

  return {
    ratingAverage: ratingCount ? toRating(summary) / ratingCount : null,
    quizAverage: quizAttempts ? Number(summary.quizScoreTotal || 0) / quizAttempts : null,
    clicksPerSession: sessionCount ? clickCount / sessionCount : null,
    averageSessionDurationSeconds: sessionCount ? totalSessionDurationSeconds / sessionCount : null,
  };
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return "-";
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const remainingSeconds = Math.round(Number(seconds) % 60);
  return totalMinutes ? `${totalMinutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

export const getRatingStats = (feedback) => {
  const ratings = feedback
    .map((item) => Number(item.rating))
    .filter((rating) => Number.isInteger(rating) && rating >= 0 && rating <= 5);
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  const distribution = [0, 1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratings.filter((value) => value === rating).length,
  }));

  return {
    reviewCount: ratings.length,
    ratingTotal: total,
    average: ratings.length ? total / ratings.length : null,
    distribution,
  };
};

export const formatAnalyticsDate = (value) => {
  if (!value) return "Never";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};
