import { RecoveryCodeMfaStrategy } from '@application/queries/strategies/recovery-code-mfa.strategy';
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
    verifyWebAuthn: jest.fn(),
    verifyRecoveryCode: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<MfaVerificationPort>;
}

function makeRecoveryCred(hash: string): UserCredentialModel {
  return UserCredentialModel.of({ type: 'recovery_code', secretHash: hash, hashAlg: 'bcrypt', enabled: true });
}

describe('RecoveryCodeMfaStrategy', () => {
  let strategy: RecoveryCodeMfaStrategy;
  let userRepo: jest.Mocked<UserWriteRepositoryPort>;
  let mfa: jest.Mocked<MfaVerificationPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = createMockUserRepo();
    mfa = createMockMfa();
    strategy = new RecoveryCodeMfaStrategy(userRepo, mfa);
  });

  it('method는 "recovery_code"', () => {
    expect(strategy.method).toBe('recovery_code');
  });

  it('code 없음 → false', async () => {
    expect(await strategy.verify({ userId: 'u1' })).toBe(false);
    expect(userRepo.findCredentialsByType).not.toHaveBeenCalled();
  });

  it('credentials 없음 → false', async () => {
    userRepo.findCredentialsByType.mockResolvedValue([]);

    expect(await strategy.verify({ userId: 'u1', code: 'ABCD-1234' })).toBe(false);
  });

  it('모든 코드 불일치 → false', async () => {
    userRepo.findCredentialsByType.mockResolvedValue([makeRecoveryCred('h1'), makeRecoveryCred('h2')]);
    mfa.verifyRecoveryCode.mockResolvedValue(false);

    expect(await strategy.verify({ userId: 'u1', code: 'ABCD-1234' })).toBe(false);
    expect(mfa.verifyRecoveryCode).toHaveBeenCalledTimes(2);
  });

  it('두 번째 코드 일치 → disable + saveCredential + true', async () => {
    const cred1 = makeRecoveryCred('h1');
    const cred2 = makeRecoveryCred('h2');
    userRepo.findCredentialsByType.mockResolvedValue([cred1, cred2]);
    mfa.verifyRecoveryCode.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await strategy.verify({ userId: 'u1', code: 'ABCD-1234' });

    expect(result).toBe(true);
    expect(cred2.enabled).toBe(false);
    expect(userRepo.saveCredential).toHaveBeenCalledWith(cred2);
  });

  it('verifyRecoveryCode 에러 발생 → continue (best-effort)', async () => {
    const cred1 = makeRecoveryCred('h1');
    const cred2 = makeRecoveryCred('h2');
    userRepo.findCredentialsByType.mockResolvedValue([cred1, cred2]);
    mfa.verifyRecoveryCode
      .mockRejectedValueOnce(new Error('error'))
      .mockResolvedValueOnce(true);

    const result = await strategy.verify({ userId: 'u1', code: 'ABCD-1234' });

    expect(result).toBe(true);
    expect(userRepo.saveCredential).toHaveBeenCalledWith(cred2);
  });
});
