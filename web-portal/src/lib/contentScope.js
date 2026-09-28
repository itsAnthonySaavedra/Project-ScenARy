export const CONTENT_SCOPES = ["Landmark", "POI"];

export const getContentScope = (content) => {
	const scope = (content?.scope || content?.contentScope || "").trim().toLowerCase();
	return CONTENT_SCOPES.find((item) => item.toLowerCase() === scope) || "";
};
