import { useState } from 'react';
import { submitConsent, abortInteraction } from '../api/client';
import type { InteractionDetails } from '../api/client';

interface Props {
  details: InteractionDetails;
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string) => void;
}

export default function ConsentPage({ details, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    setLoading(true);
    try {
      const result = await submitConsent();
      if (result.redirectTo) {
        onSuccess(result.redirectTo);
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '동의 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    try {
      const result = await abortInteraction();
      window.location.href = result.redirectTo;
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '취소에 실패했습니다.');
    }
  };

  return (
    <div className="card">
      <h1>권한 동의</h1>
      <p className="subtitle">
        <strong>{details.clientId}</strong> 앱이 다음 권한을 요청합니다:
      </p>

      <ul className="scope-list">
        {details.missingScopes.length > 0 ? (
          details.missingScopes.map((scope) => <li key={scope}>{scope}</li>)
        ) : (
          <li>기본 정보</li>
        )}
      </ul>

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleAllow}
          disabled={loading}
        >
          {loading ? '처리 중...' : '허용'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleDeny}
          disabled={loading}
        >
          거부
        </button>
      </div>
    </div>
  );
}
