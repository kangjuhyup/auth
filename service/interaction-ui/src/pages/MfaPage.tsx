import { useState } from 'react';
import MfaTotp from '../components/MfaTotp';
import MfaWebAuthn from '../components/MfaWebAuthn';
import MfaRecovery from '../components/MfaRecovery';

interface Props {
  methods: string[];
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string) => void;
}

type Tab = 'totp' | 'webauthn' | 'recovery_code';

const TAB_LABELS: Record<string, string> = {
  totp: 'TOTP',
  webauthn: 'WebAuthn',
  recovery_code: '복구 코드',
};

export default function MfaPage({ methods, onSuccess, onError }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(methods[0] as Tab);

  return (
    <div className="card">
      <h1>2단계 인증</h1>
      <p className="subtitle">추가 인증이 필요합니다.</p>

      {methods.length > 1 && (
        <div className="tab-bar">
          {methods.map((m) => (
            <button
              key={m}
              className={activeTab === m ? 'active' : ''}
              onClick={() => setActiveTab(m as Tab)}
            >
              {TAB_LABELS[m] ?? m}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'totp' && (
        <MfaTotp onSuccess={onSuccess} onError={onError} />
      )}
      {activeTab === 'webauthn' && (
        <MfaWebAuthn onSuccess={onSuccess} onError={onError} />
      )}
      {activeTab === 'recovery_code' && (
        <MfaRecovery onSuccess={onSuccess} onError={onError} />
      )}
    </div>
  );
}
