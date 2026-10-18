import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { publicFirebaseConfig } from './firebase-public';

/** 서울에 만든 촬영 지점 데이터베이스 이름입니다. 비밀 값이 아닙니다. */
export const PLACE_DATABASE_ID = 'geuttae-places';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let cached: FirebaseServices | null | undefined;

/** 공개 웹 설정이 있으면 로그인과 데이터베이스를 준비합니다. 없으면 null입니다. */
export function firebaseServices(): FirebaseServices | null {
  if (cached !== undefined) return cached;
  const config = readConfig();
  if (!config) {
    cached = null;
    return null;
  }
  const app = initializeApp(config);
  cached = { app, auth: getAuth(app), db: getFirestore(app, PLACE_DATABASE_ID) };
  return cached;
}

function readConfig(): { apiKey: string; authDomain: string; projectId: string; appId: string } | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() || publicFirebaseConfig.apiKey;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || publicFirebaseConfig.authDomain;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || publicFirebaseConfig.projectId;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() || publicFirebaseConfig.appId;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}
