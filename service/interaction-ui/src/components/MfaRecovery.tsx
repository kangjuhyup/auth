import { useState } from 'react';
import { submitMfa } from '../api/client';

interface Props {
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string) => void;
}

export default function MfaRecovery({ onSuccess, onError: _onError }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await submitMfa('recovery_code', code);
      if (result.success && result.redirectTo) {
        onSuccess(result.redirectTo);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : '복구 코드 인증에 실패했습니다.';
      if (msg === 'mfa_failed') {
        setError('복구 코드가 올바르지 않습니다.');
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

      <label htmlFor="recovery-code">복구 코드</label>
      <input
        id="recovery-code"
        type="text"
        autoComplete="off"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="xxxx-xxxx-xxxx"
        required
        disabled={loading}
      />

      <p style={{ marginBottom: 16, fontSize: '0.8rem', color: '#999' }}>
        복구 코드는 일회용이며, 사용 후 비활성화됩니다.
      </p>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? '확인 중...' : '확인'}
      </button>
    </form>
  );
}
