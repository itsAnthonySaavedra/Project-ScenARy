# Web Portal

## AR plaque images for POIs

POIs can optionally store an AR image target and its measured real-world width:

- `markerImageUrl` (string): Firebase Storage download URL for a tightly cropped, straight-on plaque photo.
- `markerWidthMeters` (number): plaque width in metres, such as `0.30` for 30 cm.
- `markerStoragePath` (string): Storage object path used by the portal when replacing or removing the image.

Admins can manage them from **POI Management**; institutions can use **POIs**. Uploading a plaque image and entering its width saves both fields to the POI document. Plaque images are stored under `markers/{institutionId}/`. The separate POI location image remains unchanged.

To seed a test POI manually, upload its photo under `markers/{institutionId}/` in Firebase Storage, copy its download URL, then add `markerImageUrl` and a numeric `markerWidthMeters` to that POI document in Firestore. The repository's `storage.rules` allows authorized uploads and public reads at that path; make sure those rules are deployed to the Firebase project. Also confirm the deployed Firestore rules allow the POI fields to be written.

The Unity project in this repository does not yet contain the mobile app’s Firestore scan flow or runtime image-tracking scripts; adding these portal fields alone does not enable AR tracking.

## Institution content limits

Institutions can create one Information item, one Quiz, and one VR Model per institution. A quiz can contain multiple true/false or multiple-choice questions and can save shuffle settings for question order and choices. Fun Fact content can contain multiple entries. POIs can be assigned Information and Fun Fact content by institution accounts; VR models and quizzes are limited to landmark content. Existing legacy model type names are normalized to **VR Model** in the portal.

The quiz builder stores its question types and shuffle settings, but this repository does not include the mobile quiz runtime that would consume them.

## Testing temporary site access

Site-access passes can be granted for 30 minutes, 1 hour, or 24 hours. For a one-minute local test option, set `VITE_SITE_ACCESS_DURATION_MS=60000` in `web-portal/.env.local` and restart the dev server; remove the setting to hide that test option. Access expiry is determined from `expiresAt`.

### Persisting expired status

The scheduled `expireSiteAccessPasses` Cloud Function checks paid passes every minute and changes expired records at `siteAccess/{institutionId}/users/{userId}` to `status: "expired"`. The admin page listens to Firestore updates and shows the persisted status. The function is in `functions/` and needs Cloud Scheduler enabled and the Firebase project on the Blaze plan.

Deploy the composite index first and wait for it to finish building, then deploy the function:

```powershell
firebase deploy --only firestore:indexes
firebase deploy --only functions:expireSiteAccessPasses
```

One job runs about 43,200 times per 30-day month. Firebase currently includes 3 Cloud Scheduler jobs per Google account at no charge; Cloud Functions includes 2 million invocations/month and Firestore includes 50,000 reads/day on Blaze. This workload should normally fit those no-cost allowances, but Blaze requires a billing account and actual charges depend on usage and region. See [Firebase pricing](https://firebase.google.com/pricing) and [scheduled functions](https://firebase.google.com/docs/functions/schedule-functions). The function marks records within about one minute of expiry; access checks should still compare `expiresAt`. The Unity project does not currently contain the phone app’s paid-access check.

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
# ScenARy v2 - React Migration

ScenARy V2 is an Augmented Reality (AR) platform for historical sites, featuring an Administrator Portal for management and an Institution Portal for content creators.

## Project Structure

This project has been migrated from a static HTML/CSS template to a modern Vite + React application with a modular architecture.

```
/
├── src/
│   ├── components/
│   │   ├── common/         # Shared UI (StatCard, Modals) & Modules (Common.module.css)
│   │   ├── features/       # Feature-specific components (Dashboard widgets)
│   │   └── layout/         # Layout wrapper, Sidebar, Header
│   ├── context/            # Global State (AuthContext)
│   ├── pages/              # Page Views (Admin, Institute, Auth, Landing)
│   └── styles/             # Global Variables & Resets (main.css)
└── public/                 # Static Assets
```

## CSS Architecture

The project uses **CSS Modules** for 100% style isolation.
-   **No Global Utility Classes**: Components import their own styles from `*.module.css`.
-   **Common Styles**: Shared patterns (Buttons, Input Fields, Modals) are imported from `src/components/common/Common.module.css`.
-   **Variables**: Design tokens (colors, fonts) are defined in `src/styles/variables.css`.

## Getting Started

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Run Development Server**
    ```bash
    npm run dev
    ```

3.  **Build for Production**
    ```bash
    npm run build
    ```

## Key Credentials (Mock)
-   **Admin Portal**: Select "Admin Login" (auto-filled mock credentials).
-   **Institute Portal**: Select "Institute Login" (auto-filled mock credentials).
