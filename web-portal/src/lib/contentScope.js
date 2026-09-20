export const CONTENT_SCOPES = ["Landmark", "POI"];

export const getContentScope = (content) => content?.scope || content?.contentScope || "";
