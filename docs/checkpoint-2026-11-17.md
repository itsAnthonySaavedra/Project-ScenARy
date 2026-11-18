# ScenARy website checkpoint, 17 November 2026

Branch `checkpoint/scenary-integration-2026-11-17` in both the website and mobile repositories. This website checkpoint starts from `features/published`.

## Included in the website checkpoint

- Export POIs for Unity from the institution POI page and the app-admin POI administration view.
- The version 1 JSON catalog contains the landmark ID/name and POI IDs, names and published content types. It includes Information, Fun Fact and Quiz entries linked to that landmark's POIs.
- POI loading and export failure handling.
- Original ScenARy logo on the landing navigation/footer, portal login and favicon.

The starting website branch already includes role, demo payment, model approval and preview-related work. The mobile checkpoint integrates the related visitor and preview behavior.

## Continue here

1. Implement interactive ZIP upload for the institution and app-admin model forms. Unity exports `model.glb` and a version 2 `tour.json` containing `anchor` / `poiId` links and the landmark ID.
2. Validate the package, store the GLB in Firebase Storage and save the model URL plus manifest in the content document using the shape supported by the mobile app. Mobile currently accepts exhibit links under `data.exhibits` or `data.customData.exhibits`.
3. Preserve `data.customData` when the app-admin model editor saves. It currently rebuilds the data object without that field, which can erase manually supplied trigger links.
4. Verify upload, approval and publication against the intended Firebase project and confirm the same content on a phone. A successful live round trip has not been verified.
5. Build and deploy the portal after validation. Full production build verification was blocked locally by unavailable dependencies/network access. The changed landing/login components passed syntax checks.

For the current manual institution workflow, extract the Unity ZIP, upload its GLB and paste `tour.json` into Custom Data (JSON) before approval. The automatic ZIP workflow remains pending. A GLB alone provides the model geometry.

The AI service is in the separate ScenARy AI repository. Mobile chat still needs a running backend with Firebase Admin credentials and a reachable address. This website checkpoint does not deploy that service.

## Developer setup

Use the project's existing Firebase configuration and authorized account. Start the portal through the scripts in `web-portal/package.json` after installing the locked dependencies. Open the mobile repository in Unity 6000.3.10f1 with Git LFS enabled to use its Tools / ScenARy authoring menus.
