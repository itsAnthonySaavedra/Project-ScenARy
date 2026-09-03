# Web Portal

## User analytics data contract

The analytics screens read two Firestore collections. They are intentionally read-only until the phone app or a trusted backend begins writing data:

- `userAnalytics/{userId}`: `userId`, `institutionId`, `displayName` or `email`, `interactionCount`, `ratingCount`, `ratingTotal`, `commentCount`, and `lastInteractionAt`.
- `feedback/{feedbackId}`: `userId`, `institutionId`, optional `landmarkId` or `contentId`, `rating` from 1 to 5, optional `comment`, and `createdAt`.

The summary document is the cached reporting layer. A later phone integration can batch events locally and update this summary periodically, while submitting feedback as individual records. For stronger trust, move those writes behind a Firebase Cloud Function before treating the values as audit data.
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
