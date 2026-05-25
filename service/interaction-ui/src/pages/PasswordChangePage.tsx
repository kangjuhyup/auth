import { useState } from 'react';
import { submitPasswordChange } from '../api/client';
import { debugInteraction } from '../lib/debug';

interface Props {
  onSuccess: (result: {
    mfaRequired?: boolean;
    mfaEnrollmentRequired?: boolean;
    methods?: string[];
    redirectTo?: string;
  }) => void;
}

export default function PasswordChangePage({ onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      debugInteraction('password-change.validation_failed', {
        reason: 'confirmation_mismatch',
      });
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (currentPassword === newPassword) {
      debugInteraction('password-change.validation_failed', {
        reason: 'same_password',
      });
      setError('새 비밀번호는 임시 비밀번호와 달라야 합니다.');
      return;
    }

    setLoading(true);
    debugInteraction('password-change.submit', {
      hasCurrentPassword: currentPassword.length > 0,
      hasNewPassword: newPassword.length > 0,
    });
    try {
      const result = await submitPasswordChange(currentPassword, newPassword);
      if (result.success) {
        debugInteraction('password-change.completed', {
          mfaRequired: result.mfaRequired === true,
          mfaEnrollmentRequired: result.mfaEnrollmentRequired === true,
          methodCount: result.methods?.length ?? 0,
          hasRedirect: Boolean(result.redirectTo),
        });
        onSuccess(result);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.';
      if (msg === 'invalid_current_password') {
        setError('현재 임시 비밀번호가 올바르지 않습니다.');
      } else if (msg === 'new_password_must_be_different') {
        setError('새 비밀번호는 임시 비밀번호와 달라야 합니다.');
      } else {
        setError(msg);
      }
      debugInteraction('password-change.failed', {
        reason: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>비밀번호 변경</h1>
      <p className="subtitle">
        임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 설정하세요.
      </p>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="currentPassword">임시 비밀번호</label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          disabled={loading}
        />

        <label htmlFor="newPassword">새 비밀번호</label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          disabled={loading}
        />

        <label htmlFor="confirmPassword">새 비밀번호 확인</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          disabled={loading}
        />

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
}
