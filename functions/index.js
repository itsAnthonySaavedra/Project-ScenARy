const { initializeApp } = require("firebase-admin/app");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { isExpiredSiteAccessPass } = require("./siteAccessExpiry");

initializeApp();

const db = getFirestore();
const MAX_CONCURRENT_TRANSACTIONS = 25;

const expireIfStillPaid = async (document, now) =>
  db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(document.ref);
    if (!currentSnapshot.exists) return false;

    const currentDocument = {
      ref: document.ref,
      data: () => currentSnapshot.data(),
    };
    if (!isExpiredSiteAccessPass(currentDocument, now.toMillis())) return false;

    transaction.update(document.ref, {
      status: "expired",
      expiredAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

exports.expireSiteAccessPasses = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Etc/UTC",
    region: "us-central1",
  },
  async () => {
    const now = Timestamp.now();
    const snapshot = await db
      .collectionGroup("users")
      .where("status", "==", "paid")
      .where("expiresAt", "<=", now)
      .get();
    const candidates = snapshot.docs.filter((document) =>
      isExpiredSiteAccessPass(document, now.toMillis()),
    );
    let expiredCount = 0;

    for (let offset = 0; offset < candidates.length; offset += MAX_CONCURRENT_TRANSACTIONS) {
      const batch = candidates.slice(offset, offset + MAX_CONCURRENT_TRANSACTIONS);
      const results = await Promise.all(
        batch.map((document) => expireIfStillPaid(document, now)),
      );
      expiredCount += results.filter(Boolean).length;
    }

    logger.info("Finished expiring site-access passes.", {
      scannedCount: snapshot.size,
      expiredCount,
    });
  },
);
