import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";

/**
 * Firebase bootstrap. Config comes from Vite env vars so keys stay out of
 * git; when they're absent the whole online feature degrades gracefully and
 * the site runs fully offline (CPU + hotseat).
 *
 * The SDK is imported dynamically so offline visitors never download it —
 * it only loads the first time someone actually uses online play.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const onlineConfigured = Boolean(config.apiKey && config.projectId);

let appPromise: Promise<FirebaseApp> | null = null;
let dbPromise: Promise<Firestore> | null = null;

async function ensureApp(): Promise<FirebaseApp> {
  if (!onlineConfigured) {
    throw new Error("Online play is not configured (missing Firebase env vars)");
  }
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp }) =>
      initializeApp({
        apiKey: config.apiKey!,
        authDomain: config.authDomain,
        projectId: config.projectId!,
        appId: config.appId,
      }),
    );
  }
  return appPromise;
}

export async function getDb(): Promise<Firestore> {
  if (!dbPromise) {
    dbPromise = Promise.all([ensureApp(), import("firebase/firestore")]).then(
      ([app, { getFirestore }]) => getFirestore(app),
    );
  }
  return dbPromise;
}

/** The firestore module itself, for doc/onSnapshot/transaction helpers. */
export function firestoreModule() {
  return import("firebase/firestore");
}

/** Anonymous sign-in on demand; resolves to a stable per-browser uid. */
export async function ensureAuth(): Promise<string> {
  const app = await ensureApp();
  const { getAuth, signInAnonymously } = await import("firebase/auth");
  const auth = getAuth(app);
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

const NAME_KEY = "versus-display-name";

export function getDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name.slice(0, 20));
}
