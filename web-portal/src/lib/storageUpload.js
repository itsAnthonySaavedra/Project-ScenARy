import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

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
