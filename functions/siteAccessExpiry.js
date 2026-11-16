const isSiteAccessDocumentPath = (path) => {
  const segments = path.split("/");
  return (
    segments.length === 4 &&
    segments[0] === "siteAccess" &&
    segments[2] === "users"
  );
};

const isExpiredSiteAccessPass = (document, nowMillis) => {
  const record = document.data();
  const expiresAtMillis = record.expiresAt?.toMillis?.();

  return (
    isSiteAccessDocumentPath(document.ref.path) &&
    record.status === "paid" &&
    Number.isFinite(expiresAtMillis) &&
    expiresAtMillis <= nowMillis
  );
};

module.exports = { isExpiredSiteAccessPass };
