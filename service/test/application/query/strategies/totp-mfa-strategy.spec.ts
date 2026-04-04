import { TotpMfaStrategy } from '@application/queries/strategies/totp-mfa.strategy';
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
    saveCredential: jest.fn(),
  } as unknown as jest.Mocked<UserWriteRepositoryPort>;
}

function createMockMfa(): jest.Mocked<MfaVerificationPort> {
  return {
    verifyTotp: jest.fn().mockReturnValue(true),
    generateWebAuthnAuthOptions: jest.fn(),
    verifyWebAuthn: jest.fn(),
    verifyRecoveryCode: jest.fn(),
  } as unknown as jest.Mocked<MfaVerificationPort>;
}

describe('TotpMfaStrategy', () => {
  let strategy: TotpMfaStrategy;
  let userRepo: jest.Mocked<UserWriteRepositoryPort>;
  let mfa: jest.Mocked<MfaVerificationPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = createMockUserRepo();
    mfa = createMockMfa();
    strategy = new TotpMfaStrategy(userRepo, mfa);
  });

  it('method는 "totp"', () => {
    expect(strategy.method).toBe('totp');
  });

  it('code 없음 → false (repo 미호출)', async () => {
    const result = await strategy.verify({ userId: 'u1' });

    expect(result).toBe(false);
    expect(userRepo.findCredentialsByType).not.toHaveBeenCalled();
  });

  it('credential 없음 → false (verifyTotp 미호출)', async () => {
    userRepo.findCredentialsByType.mockResolvedValue([]);

    const result = await strategy.verify({ userId: 'u1', code: '123456' });

    expect(result).toBe(false);
    expect(mfa.verifyTotp).not.toHaveBeenCalled();
  });

  it('verifyTotp 위임 → true 반환', async () => {
    const cred = UserCredentialModel.of({ type: 'totp', secretHash: 'secret', hashAlg: 'sha1', enabled: true });
    userRepo.findCredentialsByType.mockResolvedValue([cred]);
    mfa.verifyTotp.mockReturnValue(true);

    const result = await strategy.verify({ userId: 'u1', code: '123456' });

    expect(mfa.verifyTotp).toHaveBeenCalledWith('secret', '123456');
    expect(result).toBe(true);
  });

  it('verifyTotp false → false 반환', async () => {
    const cred = UserCredentialModel.of({ type: 'totp', secretHash: 'secret', hashAlg: 'sha1', enabled: true });
    userRepo.findCredentialsByType.mockResolvedValue([cred]);
    mfa.verifyTotp.mockReturnValue(false);

    expect(await strategy.verify({ userId: 'u1', code: 'wrong' })).toBe(false);
  });
});
