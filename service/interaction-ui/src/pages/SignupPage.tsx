import { useState } from 'react';
import { readRegistrationHandoffId, submitSignup } from '../api/client';
import type { LoginResult } from '../api/client';
import { debugInteraction } from '../lib/debug';

interface Props {
  clientId: string;
  onSuccess: (result: LoginResult) => void;
  onLogin: () => void;
}

export default function SignupPage({ clientId, onSuccess, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handoffId = readRegistrationHandoffId();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    debugInteraction('signup.submit', {
      hasUsername: username.trim().length > 0,
      hasEmail: email.trim().length > 0,
      hasPhone: phone.trim().length > 0,
      hasRegistrationHandoff: handoffId.length > 0,
    });

    try {
      const result = await submitSignup({
        username,
        password,
        handoffId,
        email: email || undefined,
        phone: phone || undefined,
      });
      onSuccess(result);
    } catch (caught: unknown) {
      const code = caught instanceof Error ? caught.message : 'signup_failed';
      setError(
        code === 'signup_not_allowed'
          ? '이 테넌트는 공개 회원가입을 허용하지 않습니다.'
          : code,
      );
      debugInteraction('signup.failed', { reason: code });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>회원가입</h1>
      <p className="subtitle">
        애플리케이션: <strong>{clientId}</strong>
      </p>

      {error && <div className="error-msg">{error}</div>}
      {!handoffId && (
        <div className="error-msg">
          Account 본인인증을 완료한 뒤 다시 돌아와 주세요.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="signup-username">사용자명</label>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          minLength={3}
          maxLength={64}
          pattern="[a-zA-Z0-9_.-]+"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          disabled={loading}
        />

        <label htmlFor="signup-email">Auth 복구 이메일(선택)</label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />

        <label htmlFor="signup-phone">Auth 복구 전화번호(선택)</label>
        <input
          id="signup-phone"
          type="tel"
          autoComplete="tel"
          pattern="\+?[0-9]{7,15}"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={loading}
        />

        <label htmlFor="signup-password">비밀번호</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={loading}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !handoffId}
        >
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <div className="abort-link">
        <button type="button" className="link-button" onClick={onLogin}>
          이미 계정이 있나요? 로그인
        </button>
      </div>
    </div>
  );
}
