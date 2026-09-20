import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export const inspectGlbTextures = async (file) => {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error("The selected file is not a valid GLB file.");
  }

  let offset = 12;
  let json = null;
  while (offset + 8 <= view.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    if (chunkType === 0x4e4f534a) {
      const bytes = new Uint8Array(buffer, offset + 8, chunkLength);
      json = JSON.parse(new TextDecoder().decode(bytes).replace(/\0+$/, ""));
      break;
    }
    offset += 8 + chunkLength;
  }

  if (!json) throw new Error("The GLB is missing its JSON scene description.");

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
  await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(fileRef);

  return {
    url,
    storagePath,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
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
