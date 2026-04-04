import { useState } from 'react';
import { submitMfa } from '../api/client';

interface Props {
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string) => void;
}

export default function MfaTotp({ onSuccess, onError: _onError }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await submitMfa('totp', code);
      if (result.success && result.redirectTo) {
        onSuccess(result.redirectTo);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'TOTP 인증에 실패했습니다.';
      if (msg === 'mfa_failed') {
        setError('인증 코드가 올바르지 않습니다.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-msg">{error}</div>}

      <label htmlFor="totp-code">인증 코드 (6자리)</label>
      <input
        id="totp-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]{6}"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
        disabled={loading}
      />

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? '확인 중...' : '확인'}
      </button>
    </form>
  );
}
