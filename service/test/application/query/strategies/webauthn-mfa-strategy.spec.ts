import { WebAuthnMfaStrategy } from '@application/queries/strategies/webauthn-mfa.strategy';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import type { MfaVerificationPort } from '@application/ports/mfa-verification.port';
import { UserCredentialModel } from '@domain/models/user-credential';

function createMockUserRepo(): jest.Mocked<UserWriteRepositoryPort> {
  return {
    findById: jest.fn(),
    findByUsername: jest.fn(),
    findByContact: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    findCredentialsByType: jest.fn().mockResolvedValue([]),
    saveCredential: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<UserWriteRepositoryPort>;
}

function createMockMfa(): jest.Mocked<MfaVerificationPort> {
  return {
    verifyTotp: jest.fn(),
    generateWebAuthnAuthOptions: jest.fn(),
    verifyWebAuthn: jest.fn().mockResolvedValue({ verified: true, newCounter: 6 }),
    verifyRecoveryCode: jest.fn(),
  } as unknown as jest.Mocked<MfaVerificationPort>;
}

function makeWebAuthnCred(credentialID: string, counter = 0): UserCredentialModel {
  return UserCredentialModel.of({
    type: 'webauthn',
    secretHash: 'pubkey-pem',
    hashAlg: 'ES256',
    hashParams: { credentialID, counter },
    enabled: true,
  });
}

describe('WebAuthnMfaStrategy', () => {
  let strategy: WebAuthnMfaStrategy;
  let userRepo: jest.Mocked<UserWriteRepositoryPort>;
  let mfa: jest.Mocked<MfaVerificationPort>;

  const baseCtx = {
    userId: 'u1',
    webauthnResponse: { id: 'cred-id-1', response: {} },
    rpId: 'example.com',
    expectedOrigin: 'https://example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = createMockUserRepo();
    mfa = createMockMfa();
    strategy = new WebAuthnMfaStrategy(userRepo, mfa);
  });

  it('method는 "webauthn"', () => {
    expect(strategy.method).toBe('webauthn');
  });

  it('webauthnResponse 없음 → false', async () => {
    expect(await strategy.verify({ userId: 'u1', rpId: 'ex.com', expectedOrigin: 'https://ex.com' })).toBe(false);
  });

  it('rpId 없음 → false', async () => {
    expect(await strategy.verify({ userId: 'u1', webauthnResponse: { id: 'x' }, expectedOrigin: 'https://ex.com' })).toBe(false);
  });

  it('expectedOrigin 없음 → false', async () => {
    expect(await strategy.verify({ userId: 'u1', webauthnResponse: { id: 'x' }, rpId: 'ex.com' })).toBe(false);
  });

  it('credentialId 없음 → false', async () => {
    expect(await strategy.verify({ userId: 'u1', webauthnResponse: {}, rpId: 'ex.com', expectedOrigin: 'https://ex.com' })).toBe(false);
  });

  it('matching credential 없음 → false', async () => {
    userRepo.findCredentialsByType.mockResolvedValue([makeWebAuthnCred('other-id')]);

    expect(await strategy.verify(baseCtx)).toBe(false);
    expect(mfa.verifyWebAuthn).not.toHaveBeenCalled();
  });

  it('검증 성공 → counter 업데이트 + saveCredential + true', async () => {
    const cred = makeWebAuthnCred('cred-id-1', 5);
    userRepo.findCredentialsByType.mockResolvedValue([cred]);
    mfa.verifyWebAuthn.mockResolvedValue({ verified: true, newCounter: 6 });

    const result = await strategy.verify(baseCtx);

    expect(result).toBe(true);
    expect(cred.hashParams?.counter).toBe(6);
    expect(userRepo.saveCredential).toHaveBeenCalledWith(cred);
  });

  it('검증 실패(verified=false) → false, saveCredential 미호출', async () => {
    const cred = makeWebAuthnCred('cred-id-1', 5);
    userRepo.findCredentialsByType.mockResolvedValue([cred]);
    mfa.verifyWebAuthn.mockResolvedValue({ verified: false, newCounter: 5 });

    expect(await strategy.verify(baseCtx)).toBe(false);
    expect(userRepo.saveCredential).not.toHaveBeenCalled();
  });

  it('verifyWebAuthn throw → false', async () => {
    const cred = makeWebAuthnCred('cred-id-1', 5);
    userRepo.findCredentialsByType.mockResolvedValue([cred]);
    mfa.verifyWebAuthn.mockRejectedValue(new Error('invalid signature'));

    expect(await strategy.verify(baseCtx)).toBe(false);
  });
});
