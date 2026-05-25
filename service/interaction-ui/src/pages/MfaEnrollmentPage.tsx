import { useEffect, useState } from 'react';
import { beginTotpEnrollment, confirmTotpEnrollment } from '../api/client';
import { debugInteraction } from '../lib/debug';

interface Props {
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string) => void;
}

export default function MfaEnrollmentPage({ onSuccess, onError }: Props) {
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [redirectTo, setRedirectTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    beginTotpEnrollment()
      .then((result) => {
        setSecret(result.secret);
        setOtpauthUrl(result.otpauthUrl);
        debugInteraction('mfa.enrollment.started', {
          method: 'totp',
          hasSecret: Boolean(result.secret),
        });
      })
      .catch((err: unknown) => {
        onError(
          err instanceof Error ? err.message : 'MFA 등록을 시작할 수 없습니다.',
        );
      })
      .finally(() => setLoading(false));
  }, [onError]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirming(true);
    setError('');

    try {
      const result = await confirmTotpEnrollment(code);
      setRecoveryCodes(result.recoveryCodes);
      setRedirectTo(result.redirectTo ?? '');
      debugInteraction('mfa.enrollment.confirmed', {
        method: 'totp',
        recoveryCodeCount: result.recoveryCodes.length,
        hasRedirect: Boolean(result.redirectTo),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'MFA 등록 확인에 실패했습니다.';
      if (msg === 'invalid_totp_code') {
        setError('인증 코드가 올바르지 않습니다.');
      } else {
        setError(msg);
      }
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="spinner" />
      </div>
    );
  }

  if (recoveryCodes.length > 0) {
    return (
      <div className="card">
        <h1>복구 코드</h1>
        <p className="subtitle">MFA 장치를 사용할 수 없을 때 사용합니다.</p>
        <ul className="recovery-list">
          {recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode}>{recoveryCode}</li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSuccess(redirectTo)}
          disabled={!redirectTo}
        >
          계속
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>MFA 등록</h1>
      <p className="subtitle">이 애플리케이션은 2단계 인증이 필요합니다.</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="secret-box">
        <label>설정 키</label>
        <code>{secret}</code>
      </div>

      <a className="setup-link" href={otpauthUrl}>
        인증 앱에 추가
      </a>

      <form onSubmit={handleConfirm}>
        <label htmlFor="totp-enrollment-code">인증 코드 (6자리)</label>
        <input
          id="totp-enrollment-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
          disabled={confirming}
        />

        <button type="submit" className="btn btn-primary" disabled={confirming}>
          {confirming ? '확인 중...' : '등록 완료'}
        </button>
      </form>
    </div>
  );
}
