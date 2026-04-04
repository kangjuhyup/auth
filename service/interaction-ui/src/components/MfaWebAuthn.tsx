import { useState } from 'react';
import { submitMfa } from '../api/client';

interface Props {
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string) => void;
}

export default function MfaWebAuthn({ onSuccess, onError: _onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuthenticate = async () => {
    setLoading(true);
    setError('');

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('이 브라우저는 WebAuthn을 지원하지 않습니다.');
      }

      const optionsRes = await fetch(
        `${window.location.pathname}/api/mfa/webauthn-options`,
        { credentials: 'same-origin' },
      );
      if (!optionsRes.ok) throw new Error('WebAuthn 옵션을 불러올 수 없습니다.');
      const options = await optionsRes.json();

      const challengeBuffer = base64urlToBuffer(options.challenge);
      const allowCredentials = (options.allowCredentials ?? []).map(
        (c: { id: string; type: string }) => ({
          ...c,
          id: base64urlToBuffer(c.id),
        }),
      );

      const credential = (await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: challengeBuffer,
          allowCredentials,
        },
      })) as PublicKeyCredential;

      const authResponse =
        credential.response as AuthenticatorAssertionResponse;

      const webauthnResponse = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: bufferToBase64url(
            authResponse.authenticatorData,
          ),
          clientDataJSON: bufferToBase64url(authResponse.clientDataJSON),
          signature: bufferToBase64url(authResponse.signature),
          userHandle: authResponse.userHandle
            ? bufferToBase64url(authResponse.userHandle)
            : undefined,
        },
        challenge: options.challenge,
      };

      const result = await submitMfa('webauthn', undefined, webauthnResponse);
      if (result.success && result.redirectTo) {
        onSuccess(result.redirectTo);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'WebAuthn 인증에 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#666' }}>
        등록된 보안 키 또는 생체인증을 사용하여 인증합니다.
      </p>

      <button
        className="btn btn-primary"
        onClick={handleAuthenticate}
        disabled={loading}
      >
        {loading ? '인증 중...' : '보안 키로 인증'}
      </button>
    </div>
  );
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
