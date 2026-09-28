export const MODEL_CONTENT_TYPE = "AR/VR Model";
export const LEGACY_MODEL_CONTENT_TYPE = "3D Model";

export const normalizeContentType = (type) =>
	type === LEGACY_MODEL_CONTENT_TYPE ? MODEL_CONTENT_TYPE : type;

export const isModelContentType = (type) =>
	type === MODEL_CONTENT_TYPE || type === LEGACY_MODEL_CONTENT_TYPE;

export const CONTENT_TYPES = ["Information", MODEL_CONTENT_TYPE, "Quiz", "Fun Fact"];
