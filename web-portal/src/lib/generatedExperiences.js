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
      ...landmarkPois.flatMap((poi) => poi.contentIds || []),
    ]);

    return {
      id: landmark.id,
      title: landmark.landmarkName || landmark.institutionName || "Landmark experience",
      poiCount: landmarkPois.length,
      contentItems: [...contentIds]
        .map((contentId) => publishedContentById.get(contentId))
        .filter(Boolean),
    };
  });
};