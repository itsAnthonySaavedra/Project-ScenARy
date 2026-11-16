export const MODEL_CONTENT_TYPE = "VR Model";
export const LEGACY_MODEL_CONTENT_TYPE = "3D Model";
export const LEGACY_MODEL_CONTENT_TYPES = [LEGACY_MODEL_CONTENT_TYPE, "AR/VR Model"];

export const normalizeContentType = (type) =>
	LEGACY_MODEL_CONTENT_TYPES.includes(type) ? MODEL_CONTENT_TYPE : type;

export const isModelContentType = (type) =>
	type === MODEL_CONTENT_TYPE || LEGACY_MODEL_CONTENT_TYPES.includes(type);

export const CONTENT_TYPES = ["Information", MODEL_CONTENT_TYPE, "Quiz", "Fun Fact"];

export const getInstitutionContentLimitError = (contents, type, excludedId) => {
	const normalizedType = normalizeContentType(type);
	if (!["Information", MODEL_CONTENT_TYPE, "Quiz"].includes(normalizedType)) {
		return "";
	}

	const existingItem = contents.find(
		(item) => item.id !== excludedId && normalizeContentType(item.type) === normalizedType,
	);
	if (!existingItem) return "";

	const label = normalizedType === MODEL_CONTENT_TYPE ? "VR model" : normalizedType;
	return `Only one ${label} is allowed per institution. Edit the existing item instead.`;
};
