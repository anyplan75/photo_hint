import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseServices } from './firebase-app';

export interface Session {
  ready: boolean;
  configured: boolean;
  email: string | null;
  uid: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

/** 로그인 상태를 구독합니다. 설정이 없으면 계정 없이 로컬만 씁니다. */
export function useSession(): Session {
  const services = firebaseServices();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!services);

  useEffect(() => {
    if (!services) return;
    return onAuthStateChanged(services.auth, (next) => {
      setUser(next);
      setReady(true);
    });
  }, [services]);

  return {
    ready,
    configured: Boolean(services),
    email: user?.email ?? null,
    uid: user?.uid ?? null,
    async signUp(email: string, password: string) {
      if (!services) throw new Error('missing-config');
      await createUserWithEmailAndPassword(services.auth, email.trim(), password);
    },
    async signIn(email: string, password: string) {
      if (!services) throw new Error('missing-config');
      await signInWithEmailAndPassword(services.auth, email.trim(), password);
    },
    async signOutUser() {
      if (!services) return;
      await signOut(services.auth);
    },
  };
}

export function authErrorText(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입한 아이디입니다. 로그인하세요.';
    case 'auth/invalid-email':
      return '아이디는 이메일 주소여야 합니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '아이디 또는 비밀번호가 맞지 않습니다.';
    case 'auth/unauthorized-domain':
      return '이 주소에서는 로그인할 수 없습니다.';
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 뒤 다시 하세요.';
    case 'auth/network-request-failed':
      return '네트워크에 연결하지 못했습니다.';
    default:
      return '로그인하지 못했습니다. 아이디와 비밀번호를 다시 확인하세요.';
  }
}
