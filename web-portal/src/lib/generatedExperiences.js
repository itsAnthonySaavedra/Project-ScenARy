import { MODEL_CONTENT_TYPE, normalizeContentType } from "./contentTypes.js";
import {
  hasPublishedLandmarkARContent,
  isContentReady,
} from "./contentQuality.js";

export const buildGeneratedExperiences = (landmarks, pois, content) => {
  const publishedContentById = new Map(
    content
      .filter((item) => item.status === "Published")
      .map((item) => [item.id, item]),
  );

  return landmarks.map((landmark) => {
    const landmarkPois = pois
      .filter((poi) => poi.landmarkId === landmark.id)
      .sort((left, right) => (left.name || "").localeCompare(right.name || ""));
    const contentIds = new Set([
      ...(landmark.contentIds || []),
      ...(landmark.vrPublishedContentId ? [landmark.vrPublishedContentId] : []),
      ...landmarkPois.flatMap((poi) => poi.contentIds || []),
    ]);

    const contentItems = [...contentIds]
      .map((contentId) => publishedContentById.get(contentId))
      .filter(Boolean);
    const hasPublishedVR = contentItems.some(
      (item) =>
        normalizeContentType(item.type) === MODEL_CONTENT_TYPE &&
        isContentReady(item),
    );
    const releaseTarget = {
      ...landmark,
      contentIds: [
        ...(Array.isArray(landmark.contentIds) ? landmark.contentIds : []),
        ...landmarkPois.flatMap((poi) => Array.isArray(poi.contentIds) ? poi.contentIds : []),
      ],
    };
    const isReleased =
      hasPublishedLandmarkARContent(releaseTarget, contentItems) && hasPublishedVR;

    return {
      id: landmark.id,
      title: landmark.landmarkName || landmark.institutionName || "Landmark experience",
      poiCount: landmarkPois.length,
      isReleased,
      contentItems: isReleased ? contentItems : [],
    };
  });
};