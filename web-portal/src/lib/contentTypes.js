export const MODEL_CONTENT_TYPE = "VR Model";
export const LEGACY_MODEL_CONTENT_TYPE = "3D Model";
export const LEGACY_MODEL_CONTENT_TYPES = [LEGACY_MODEL_CONTENT_TYPE, "AR/VR Model"];

export const normalizeContentType = (type) =>
	LEGACY_MODEL_CONTENT_TYPES.includes(type) ? MODEL_CONTENT_TYPE : type;

export const isModelContentType = (type) =>
	type === MODEL_CONTENT_TYPE || LEGACY_MODEL_CONTENT_TYPES.includes(type);

export const CONTENT_TYPES = ["Information", MODEL_CONTENT_TYPE, "Quiz", "Fun Fact"];

const LIMITED_ASSIGNMENT_TYPES = {
	Landmark: ["Information", MODEL_CONTENT_TYPE, "Quiz"],
	POI: ["Information", "Quiz"],
};

export const getContentAssignmentLimitError = (scope, contentIds, contents) => {
	const limitedTypes = LIMITED_ASSIGNMENT_TYPES[scope] || [];
	const itemsById = new Map(contents.map((item) => [item.id, item]));
	const assignedTypes = new Set();

	for (const contentId of new Set(contentIds)) {
		const item = itemsById.get(contentId);
		if (!item) continue;

		const type = normalizeContentType(item.type);
		if (scope === "POI" && isModelContentType(item.type)) {
			return "VR models can only be assigned to Landmarks.";
		}
		if (!limitedTypes.includes(type)) continue;
		if (assignedTypes.has(type)) {
			const label = type === MODEL_CONTENT_TYPE ? "VR model" : type;
			return `Each ${scope} can have only one ${label}.`;
		}
		assignedTypes.add(type);
	}

	return "";
};
