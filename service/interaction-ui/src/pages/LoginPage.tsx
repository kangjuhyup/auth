import { useState } from 'react';
import { submitLogin, abortInteraction, getIdpUrl } from '../api/client';
import type { InteractionDetails } from '../api/client';
import IdpButton from '../components/IdpButton';

interface Props {
  details: InteractionDetails;
  onSuccess: (result: {
    mfaRequired: boolean;
    methods?: string[];
    redirectTo?: string;
  }) => void;
  onError: (msg: string) => void;
}

export default function LoginPage({ details, onSuccess, onError }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await submitLogin(username, password);
      if (result.success) {
        onSuccess(result);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '로그인에 실패했습니다.';
      if (msg === 'invalid_credentials') {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    try {
      const result = await abortInteraction();
      window.location.href = result.redirectTo;
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '취소에 실패했습니다.');
    }
  };

  return (
    <div className="card">
      <h1>로그인</h1>
      <p className="subtitle">
        애플리케이션: <strong>{details.clientId}</strong>
      </p>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="username">사용자명</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
        />

        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      {details.idpList.length > 0 && (
        <>
          <div className="divider">
            <span>또는</span>
          </div>
          {details.idpList.map((idp) => (
            <IdpButton
              key={idp.provider}
              provider={idp.provider}
              name={idp.name}
              onClick={() => {
                window.location.href = getIdpUrl(idp.provider);
              }}
            />
          ))}
        </>
      )}

      <div className="abort-link">
        <a href="#" onClick={handleAbort}>
          취소
        </a>
      </div>
    </div>
  );
}
