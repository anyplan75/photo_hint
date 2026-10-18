import { useState, type FormEvent } from 'react';
import { authErrorText, type Session } from './session';

type Mode = 'login' | 'signup';

/** 아이디는 이메일 주소입니다. 비밀번호로 가입하고 로그인합니다. */
export function AccountPanel({ session }: { session: Session }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') await session.signUp(email, password);
      else await session.signIn(email, password);
      setPassword('');
    } catch (caught) {
      const code = caught && typeof caught === 'object' && 'code' in caught ? String(caught.code) : '';
      setError(authErrorText(code));
    } finally {
      setBusy(false);
    }
  }

  if (!session.configured) {
    return (
      <section className="panel account-panel" data-account="missing" aria-labelledby="account-title">
        <div className="panel-head">
          <h2 id="account-title">계정</h2>
          <p>계정 연결이 아직 없습니다. 촬영 지점은 이 브라우저에만 남습니다.</p>
        </div>
      </section>
    );
  }

  if (session.email) {
    return (
      <section className="panel account-panel" data-account="in" aria-labelledby="account-title">
        <div className="panel-head">
          <h2 id="account-title">계정</h2>
          <p>같은 아이디로 맥, 아이폰, 웹사이트의 촬영 지점이 맞춰집니다.</p>
        </div>
        <p className="where-kicker" data-account-email={session.email}>
          로그인됨 · {session.email}
        </p>
        <p className="note">로그아웃해도 계정에 올라간 촬영 지점은 서버에 남습니다.</p>
        <button className="ghost slim" type="button" data-account-logout disabled={busy} onClick={() => void session.signOutUser()}>
          로그아웃
        </button>
      </section>
    );
  }

  return (
    <section className="panel account-panel" data-account="out" aria-labelledby="account-title">
      <div className="panel-head">
        <h2 id="account-title">계정</h2>
        <p>아이디는 이메일 주소입니다. 로그인하면 저장한 촬영 지점이 맥, 아이폰, 웹사이트에서 같이 보입니다.</p>
      </div>
      <div className="view-switch account-switch" role="group" aria-label="로그인 또는 가입">
        <button type="button" data-account-mode="login" aria-pressed={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
          로그인
        </button>
        <button type="button" data-account-mode="signup" aria-pressed={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
          가입
        </button>
      </div>
      <form className="account-fields" data-account-form={mode} onSubmit={submit}>
        <label htmlFor="account-email">아이디 (이메일)</label>
        <input
          id="account-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          placeholder="name@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="account-password">비밀번호</label>
        <input
          id="account-password"
          name="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="ghost slim" type="submit" disabled={busy}>
          {busy ? '확인 중' : mode === 'signup' ? '가입하기' : '로그인'}
        </button>
      </form>
      {error && <p className="note error">{error}</p>}
      <p className="note">로그인하지 않으면 이 브라우저에만 남고, 그 복사본은 계정을 덮어쓰지 않습니다.</p>
    </section>
  );
}
