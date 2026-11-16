const test = require("node:test");
const assert = require("node:assert/strict");
const { isExpiredSiteAccessPass } = require("./siteAccessExpiry");

const makeDocument = (path, status, expiresAtMillis) => ({
  ref: { path },
  data: () => ({
    status,
    ...(expiresAtMillis === undefined
      ? {}
      : { expiresAt: { toMillis: () => expiresAtMillis } }),
  }),
});

test("expires only paid site-access records whose timestamp has passed", () => {
  assert.equal(
    isExpiredSiteAccessPass(
      makeDocument("siteAccess/site-a/users/user-a", "paid", 1000),
      1000,
    ),
    true,
  );
  assert.equal(
    isExpiredSiteAccessPass(
      makeDocument("siteAccess/site-a/users/user-a", "paid", 1001),
      1000,
    ),
    false,
  );
  assert.equal(
    isExpiredSiteAccessPass(
      makeDocument("siteAccess/site-a/users/user-a", "inactive", 1000),
      1000,
    ),
    false,
  );
});

test("ignores documents outside the site-access users subcollection", () => {
  assert.equal(
    isExpiredSiteAccessPass(makeDocument("users/user-a", "paid", 1000), 1000),
    false,
  );
  assert.equal(
    isExpiredSiteAccessPass(
      makeDocument("other/site-a/users/user-a", "paid", 1000),
      1000,
    ),
    false,
  );
});
