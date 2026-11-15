const firebaseErrorMessages = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/wrong-password": "The email or password is incorrect.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/user-disabled": "This account is disabled. Contact an administrator.",
  "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
  "auth/network-request-failed": "Unable to reach Firebase. Check your internet connection and try again.",
  "auth/requires-recent-login": "Sign out, sign back in, and try changing your password again.",
  "auth/profile-update-failed": "Your password changed, but your account profile could not be updated. Contact an administrator before signing out.",
  "auth/email-already-in-use": "This email address is already registered.",
  "auth/weak-password": "Choose a stronger password.",
  "permission-denied": "You do not have permission to complete this action.",
  "firestore/permission-denied": "You do not have permission to complete this action.",
  unauthenticated: "Your session has expired. Sign in again and retry.",
  unavailable: "Firebase is temporarily unavailable. Check your connection and retry.",
  "deadline-exceeded": "The request took too long. Check your connection and retry.",
  "storage/unauthorized": "You do not have permission to upload this file.",
};

export const getFirebaseErrorMessage = (error, fallback) => {
  const code = error?.code;
  return Object.hasOwn(firebaseErrorMessages, code)
    ? firebaseErrorMessages[code]
    : fallback;
};
