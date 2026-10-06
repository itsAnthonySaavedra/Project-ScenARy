import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase";

export const MAX_GLB_FILE_SIZE_BYTES = 1024 * 1024 * 1024;

export const inspectGlbTextures = async (file) => {
  if (file.size < 20) {
    throw new Error("The selected file is not a valid GLB file.");
  }

  const header = new DataView(await file.slice(0, 20).arrayBuffer());
  const declaredLength = header.getUint32(8, true);
  const jsonLength = header.getUint32(12, true);
  if (header.getUint32(0, true) !== 0x46546c67 || declaredLength !== file.size) {
    throw new Error("The selected file is not a valid GLB file.");
  }
  if (header.getUint32(16, true) !== 0x4e4f534a || jsonLength > declaredLength - 20) {
    throw new Error("The GLB is missing its JSON scene description.");
  }

  const jsonBuffer = await file.slice(20, 20 + jsonLength).arrayBuffer();
  const json = JSON.parse(new TextDecoder().decode(jsonBuffer).replace(/\0+$/, ""));

  const externalImageUris = (json.images || [])
    .map((image) => image.uri)
    .filter((uri) => typeof uri === "string" && !uri.startsWith("data:"));

  return {
    imageCount: (json.images || []).length,
    embeddedImageCount: (json.images || []).filter((image) => image.bufferView !== undefined || image.uri?.startsWith("data:")).length,
    externalImageUris,
    extensionsUsed: json.extensionsUsed || [],
  };
};

export const uploadStorageFile = async (file, folder) => {
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
  const storagePath = `${folder}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, storagePath);
  const contentType = file.name.toLowerCase().endsWith(".glb")
    ? "model/gltf-binary"
    : file.type || "application/octet-stream";
  await uploadBytesResumable(fileRef, file, { contentType });
  const url = await getDownloadURL(fileRef);

  return {
    url,
    storagePath,
    fileName: file.name,
    fileType: contentType,
    fileSize: file.size,
  };
};

export const deleteStorageFile = async (storagePath) => {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (error.code !== "storage/object-not-found") throw error;
  }
};
