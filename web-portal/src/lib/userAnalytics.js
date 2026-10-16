import leoProfanity from "leo-profanity";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Cached summary contract: users/{uid}/analytics/summary is represented here
// as a top-level userAnalytics/{uid} document for simple role-scoped queries.
export const loadUserAnalytics = async (institutionId = null) => {
  const analyticsQuery = institutionId
    ? query(collection(db, "userAnalytics"), where("institutionId", "==", institutionId))
    : query(collection(db, "userAnalytics"));
  const snapshot = await getDocs(analyticsQuery);
  return Promise.all(snapshot.docs.map(async (item) => {
    const data = item.data();
    const userId = data.userId || item.id;
    const [profileSnapshot, buttonClicksSnapshot, quizStatsSnapshot] = await Promise.all([
      getDoc(doc(db, "users", userId)).catch(() => null),
      getDocs(collection(db, "userAnalytics", item.id, "buttonClicks")).catch(() => null),
      getDocs(collection(db, "userAnalytics", item.id, "quizStats")).catch(() => null),
    ]);
    const profile = profileSnapshot?.exists() ? profileSnapshot.data() : {};
    const scopedInstitutionId = institutionId || data.institutionId;
    const buttonClickRows = (buttonClicksSnapshot?.docs || [])
      .map((child) => child.data())
      .filter((child) => !scopedInstitutionId || !child.institutionId || child.institutionId === scopedInstitutionId);
    const quizStatRows = (quizStatsSnapshot?.docs || [])
      .map((child) => child.data())
      .filter((child) => !scopedInstitutionId || !child.institutionId || child.institutionId === scopedInstitutionId);
    const sumField = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
    const latestQuizAt = quizStatRows
      .map((row) => row.lastAttemptAt)
      .filter(Boolean)
      .sort((left, right) => timestampValue(right) - timestampValue(left))[0] || null;
    const latestClickAt = buttonClickRows
      .map((row) => row.lastClickAt)
      .filter(Boolean)
      .sort((left, right) => timestampValue(right) - timestampValue(left))[0] || null;
    const label = profile.username || profile.name || profile.displayName || data.username || data.displayName || profile.email || data.email;
    return {
      id: item.id,
      ...data,
      buttonClicks: {
        arClicks: sumField(buttonClickRows, "arClicks"),
        vrClicks: sumField(buttonClickRows, "vrClicks"),
        quizClicks: sumField(buttonClickRows, "quizClicks"),
        lastClickAt: latestClickAt,
      },
      quizStats: {
        quizzesTaken: sumField(quizStatRows, "quizzesTaken"),
        totalQuestions: sumField(quizStatRows, "totalQuestions"),
        totalScore: sumField(quizStatRows, "totalScore"),
        lastAttemptAt: latestQuizAt,
      },
      username: label ? String(label).split("@")[0] : "Unknown user",
    };
  }));
};

export const cleanFeedbackComment = (comment) =>
  leoProfanity.clean(String(comment || ""));

export const loadFeedback = async (institutionId = null) => {
  const feedbackQuery = institutionId
    ? query(collection(db, "feedback"), where("institutionId", "==", institutionId))
    : query(collection(db, "feedback"));
  const snapshot = await getDocs(feedbackQuery);
  const feedbackRows = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt));
  const userIds = [...new Set(feedbackRows.map((item) => item.userId || item.uid).filter(Boolean))];
  const profiles = new Map(await Promise.all(userIds.map(async (userId) => {
    const profileSnapshot = await getDoc(doc(db, "users", userId)).catch(() => null);
    return [userId, profileSnapshot?.exists() ? profileSnapshot.data() : {}];
  })));

  return feedbackRows.map((item) => {
    const profile = profiles.get(item.userId || item.uid) || {};
    const label = profile.username || item.username || item.userName || profile.name || item.name
      || profile.displayName || item.displayName || profile.email || item.email;
    return { ...item, username: label ? String(label).split("@")[0] : "Unknown user" };
  });
};

export const loadTourFeedback = async (tourId) => {
  const feedbackQuery = query(collection(db, "feedback"), where("tourId", "==", tourId));
  const snapshot = await getDocs(feedbackQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const loadTourViews = async (tourId) => {
  const viewsQuery = query(collection(db, "tourViews"), where("tourId", "==", tourId));
  const snapshot = await getDocs(viewsQuery);
  return snapshot.size;
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

export const normalizeFieldName = (fieldName) => String(fieldName).replace(/\d+$/, "");

export const findNumericValue = (summary, fieldNames) => {
  for (const fieldName of fieldNames) {
    const directValue = summary?.[fieldName];
    if (directValue !== undefined && directValue !== null && directValue !== "") {
      return Number(directValue || 0);
    }
  }

  for (const [fieldName, value] of Object.entries(summary || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (fieldNames.includes(normalizeFieldName(fieldName))) {
      return Number(value || 0);
    }
  }

  return 0;
};

export const toRating = (summary) =>
  Number(findNumericValue(summary, ["ratingTotal"]) || 0);

export const getUserAnalyticsMetrics = (summary) => {
  const ratingCount = findNumericValue(summary, ["ratingCount"]);
  const ratingTotal = findNumericValue(summary, ["ratingTotal"]);
  const quizAttempts = findNumericValue(summary?.quizStats, ["quizzesTaken", "quizAttempts"])
    || findNumericValue(summary, ["quizAttempts", "quizzesTaken"]);
  const quizScoreTotal = findNumericValue(summary, ["quizScoreTotal"]);
  const sessionCount = findNumericValue(summary, ["sessionCount"]);
  const arClicks = findNumericValue(summary?.buttonClicks, ["arClicks"]);
  const vrClicks = findNumericValue(summary?.buttonClicks, ["vrClicks"]);
  const quizClicks = findNumericValue(summary?.buttonClicks, ["quizClicks"]);
  const buttonClickTotal = arClicks + vrClicks + quizClicks;
  const clickCount = findNumericValue(summary, ["clickCount"]) || buttonClickTotal || findNumericValue(summary, ["interactionCount"]);
  const totalSessionDurationSeconds = findNumericValue(summary, ["totalSessionDurationSeconds", "totalSessionSeconds"]);
  const commentCount = findNumericValue(summary, ["commentCount"]);
  const totalQuizQuestions = findNumericValue(summary?.quizStats, ["totalQuestions"])
    || findNumericValue(summary, ["quizTotalQuestions"]);
  const quizTotalScore = findNumericValue(summary?.quizStats, ["totalScore"])
    || findNumericValue(summary, ["quizTotalScore"]);
  const hasRawQuizScore = summary?.quizStats?.totalScore !== undefined
    || (summary?.quizTotalScore !== undefined && summary.quizTotalScore !== null && summary.quizTotalScore !== "");
  const lastQuizAt = summary?.quizStats?.lastAttemptAt || summary?.lastQuizAt || null;
  const quizAverage = hasRawQuizScore
    ? totalQuizQuestions > 0 ? (quizTotalScore / totalQuizQuestions) * 100 : null
    : quizAttempts ? quizScoreTotal / quizAttempts : null;

  return {
    ratingAverage: ratingCount ? ratingTotal / ratingCount : null,
    quizAverage,
    clicksPerSession: sessionCount ? clickCount / sessionCount : null,
    averageSessionDurationSeconds: sessionCount ? totalSessionDurationSeconds / sessionCount : null,
    arClicks,
    vrClicks,
    quizClicks,
    buttonClickTotal,
    clickCount,
    commentCount,
    quizAttempts,
    totalQuizQuestions,
    sessionCount,
    totalSessionDurationSeconds,
    lastSessionDurationSeconds: findNumericValue(summary, ["lastSessionDurationSeconds"]),
    lastSessionAt: summary?.lastSessionAt || null,
    lastClickAt: summary?.buttonClicks?.lastClickAt || summary?.lastClickAt || null,
    lastActiveAt: [summary?.lastSessionAt, summary?.lastInteractionAt]
      .filter(Boolean)
      .sort((left, right) => timestampValue(right) - timestampValue(left))[0] || null,
    lastQuizAt,
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
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
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
