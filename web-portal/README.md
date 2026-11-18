# ScenARy Web Portal

The React portal lets administrators and institutions manage landmarks, POIs, AR markers, visitor content, and virtual tour models. The separate **ScenARy Mobile** app consumes published content from Firebase.

## Run locally

From the website repository root, install the locked dependencies and start Vite.

```powershell
cd web-portal
npm ci
npm run dev
```

Sign in with a Firebase account assigned to the appropriate administrator or institution role. The shared Firebase client configuration is in [src/lib/firebase.js](src/lib/firebase.js). Run `npm run build` from `web-portal` to build into `dist/`, or run `npm run preview` to serve that build locally.

## Export, upload, and publish an interactive tour

1. Set up the landmark and its POIs, then assign the published content each stop should show.
2. Open **POIs** as the institution, or **POI Management** as an administrator and select the institution. Choose **Export POIs for Unity** on the landmark's card. The JSON contains landmark and POI IDs, names, and published content types.
3. Send the JSON and GLB to the Unity developer. They can import the catalog or load the landmark's POIs directly from Firebase in the [Unity project](https://github.com/kirksamutya/ScenARy). They link model objects to existing POIs and export a ZIP with `model.glb` and `tour.json`.
4. In the app admin portal, open **Content Management → Upload interactive tour** and choose the ZIP. Review the landmark and its trigger links, then click **Upload for review**. The portal saves the GLB to Firebase Storage and the trigger links with the draft in Firestore.
5. The institution previews and approves the draft. In the admin portal, choose **Approve & publish**. If a tour is already published for that landmark, visitors can keep opening it until the replacement is approved. A mobile build that supports POI triggers picks up new published tours on its next online open.

The portal stores the GLB in Firebase Storage and the object-to-POI links in Firestore. The app draws the distance indicators from those links and opens the POI's published Information, Fun Facts, and Quiz content. Older GLB-only app builds need one update for interactive stops.

## Interactive tours checkpoint

Local checks covered Unity ZIP parsing and the approval and replacement flow with simulated Firebase data. The live Firebase check confirmed that Fort San Pedro has a published GLB and AR POIs with published content. The production ZIP upload through Android playback still needs an end-to-end test. Firestore allowed public writes at the time of the check. Restrict access before a production release.

The AI guide opens inside the AR and VR viewers in **ScenARy Mobile** and connects to the separate **ScenARy AI** backend.

## Project structure

| Path | Purpose |
|---|---|
| `src/pages/` | Landing, authentication, institution, and admin screens |
| `src/components/` | Shared components and layouts |
| `src/context/` | Authentication and session state |
| `src/lib/` | Firebase access and shared content helpers |
| `src/styles/` | Global design tokens and base styles. Components also use CSS Modules. |
| `public/` | Static assets, including the transparent ScenARy mark |

## AR plaque images for POIs

POIs can optionally store an AR image target and its measured real-world width:

- `markerImageUrl` (string): Firebase Storage download URL for a tightly cropped, straight-on plaque photo.
- `markerWidthMeters` (number): plaque width in metres, such as `0.30` for 30 cm.
- `markerStoragePath` (string): Storage object path used by the portal when replacing or removing the image.

Admins can manage them from **POI Management**; institutions can use **POIs**. Uploading a plaque image and entering its width saves both fields to the POI document. Plaque images are stored under `markers/{institutionId}/`. The separate POI location image remains unchanged.

The separate ScenARy Mobile Unity project uses these fields in its AR plaque scanner. After editing a test POI, use an ARCore-capable Android phone to check the site QR, stop selection, and plaque scan.

## Institution content limits

Institutions can create one Information item, one Quiz, and one VR Model per institution. A quiz can contain multiple true/false or multiple-choice questions and can save shuffle settings for question order and choices. Fun Fact content can contain multiple entries. The POI catalog uses assigned and published Information, Fun Fact, and Quiz content. VR models belong to landmarks. Existing legacy model type names are normalized to **VR Model** in the portal.

## Testing temporary site access

Site-access passes can be granted for a one-minute test or 24 hours. One-minute test passes do not add revenue.

Each institution can store its 24-hour pass price as `dayPassPriceCentavos` on `institutions/{institutionId}`. The value is an integer number of PHP centavos (for example, ₱50.00 is `5000`). A day pass cannot be granted until a price is configured.

Admin-granted day passes add a record to `siteAccess/{institutionId}/transactions/{transactionId}` with `amountCentavos`, `currency`, `durationMs`, `type`, `source`, `userId`, and creation metadata. User Management shows the selected site's revenue; admin analytics shows platform total and per-institution totals. These entries represent admin-granted pass value as requested; they are not verified payment receipts. Phone purchases are not included until a trusted payment integration writes verified transactions using the same ledger.

The institution dashboard and analytics page read the transaction subcollection for the signed-in user's `institutionId`. Deployed Firestore rules must independently restrict each institution to its own transaction subcollection; filtering the path in the client is not an authorization boundary.

### Persisting expired status

The scheduled `expireSiteAccessPasses` Cloud Function checks paid passes every minute and changes expired records at `siteAccess/{institutionId}/users/{userId}` to `status: "expired"`. The admin page listens to Firestore updates and shows the persisted status. The function is in `functions/` and needs Cloud Scheduler enabled and the Firebase project on the Blaze plan.

Deploy the composite index first and wait for it to finish building, then deploy the function:

```powershell
firebase deploy --only firestore:indexes
firebase deploy --only functions:expireSiteAccessPasses
```

Check [Firebase pricing](https://firebase.google.com/pricing) before deploying the scheduler. The function updates the stored status on its next run. The mobile app also checks the pass's `expiresAt` when granting access. Pass purchases currently use the demo flow.

## User analytics data contract

The analytics screens read two Firestore collections. They are intentionally read-only until the phone app or a trusted backend begins writing data:

- `userAnalytics/{userId}`: `userId`, `institutionId`, `displayName` or `email`, `interactionCount`, `ratingCount`, `ratingTotal`, `commentCount`, and `lastInteractionAt`. Quiz metrics may use `quizTotalScore` (total correct answers) with `quizTotalQuestions`, or legacy `quizScoreTotal` (percentage points) with `quizAttempts`. Other optional metrics are `clickCount`, `sessionCount`, and `totalSessionDurationSeconds`.
- `userAnalytics/{userId}/buttonClicks/{institutionId}`: optional `institutionId`, `arClicks`, `vrClicks`, `quizClicks`, and `lastClickAt`.
- `userAnalytics/{userId}/quizStats/{institutionId}`: optional `institutionId`, `quizzesTaken`, `totalQuestions`, `totalScore`, and `lastAttemptAt`.
- `feedback/{feedbackId}`: `userId`, `institutionId`, optional `landmarkId` or `contentId`, `rating` from 1 to 5, optional `comment`, and `createdAt`.

The summary document is the cached reporting layer. A later phone integration can batch events locally and update this summary periodically, while submitting feedback as individual records. For stronger trust, move those writes behind a Firebase Cloud Function before treating the values as audit data.

The portal combines the optional click and quiz subcollections with the cached summary, while keeping `interactionCount` distinct from the AR, VR, and quiz button-click totals. It derives per-user rating average, quiz accuracy from score/question totals when available, legacy quiz average from percentage points per attempt, clicks per session, and average session duration. Session summaries may use `totalSessionDurationSeconds` or `totalSessionSeconds`, and `lastSessionAt` is used as the latest activity time when present. Existing summary documents remain valid when the detailed metrics are absent.

## Audit actions

Audit records are stored in `auditLogs` with `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `metadata`, `source`, and `createdAt`. The portal records:

- `auth.login`, `auth.logout`
- `user.created`, `user.updated`, `user.banned`, `user.unbanned`
- `institution.created`, `institution.updated`, `institution.deleted`
- `content.created`, `content.updated`, `content.deleted`
- `feedback.deleted`
- `analytics.viewed`

The same pattern can cover `landmark.created`, `landmark.updated`, `landmark.deleted`, `poi.created`, `poi.updated`, `poi.deleted`, `tour.created`, `tour.updated`, `tour.deleted`, `quiz.completed`, and `session.started` / `session.ended` when those events are written by the institution portal, mobile app, or trusted backend.
