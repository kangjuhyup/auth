import { UserCredentialModel } from '@domain/models/user-credential';

describe('UserCredentialModel', () => {
  describe('password', () => {
    it('비밀번호 크리덴셜을 생성한다', () => {
      const cred = UserCredentialModel.password({
        secretHash: 'hashed-value',
        hashAlg: 'argon2id',
        hashParams: { timeCost: 3 },
        hashVersion: 1,
      });

      expect(cred.type).toBe('password');
      expect(cred.secretHash).toBe('hashed-value');
      expect(cred.hashAlg).toBe('argon2id');
      expect(cred.hashParams).toEqual({ timeCost: 3 });
      expect(cred.hashVersion).toBe(1);
    });

    it('생성 시 enabled가 true이다', () => {
      const cred = UserCredentialModel.password({
        secretHash: 'hashed-value',
        hashAlg: 'argon2id',
      });

      expect(cred.enabled).toBe(true);
    });

    it('expiresAt은 기본적으로 설정되지 않는다', () => {
      const cred = UserCredentialModel.password({
        secretHash: 'hashed-value',
        hashAlg: 'argon2id',
      });

      expect(cred.expiresAt).toBeUndefined();
    });

    it('hashParams와 hashVersion은 선택 항목이다', () => {
      const cred = UserCredentialModel.password({
        secretHash: 'hashed-value',
        hashAlg: 'pbkdf2-sha256',
      });

      expect(cred.hashParams).toBeUndefined();
      expect(cred.hashVersion).toBeUndefined();
    });

    it('secretHash가 비어있으면 에러를 던진다', () => {
      expect(() =>
        UserCredentialModel.password({
          secretHash: '',
          hashAlg: 'argon2id',
        }),
      ).toThrow('SecretHashRequired');
    });

    it('hashAlg가 비어있으면 에러를 던진다', () => {
      expect(() =>
        UserCredentialModel.password({
          secretHash: 'hashed-value',
          hashAlg: '',
        }),
      ).toThrow('HashAlgRequired');
    });
  });
});
