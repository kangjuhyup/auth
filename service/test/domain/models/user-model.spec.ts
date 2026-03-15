import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';

describe('UserModel', () => {
  const makeCredential = () =>
    UserCredentialModel.password({
      secretHash: 'hashed-pw',
      hashAlg: 'argon2id',
      hashParams: { timeCost: 3 },
      hashVersion: 1,
    });

  function makeActiveUser(overrides?: Partial<Parameters<typeof UserModel.of>[0]>): UserModel {
    return UserModel.of({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'john',
      email: null,
      emailVerified: false,
      phone: null,
      phoneVerified: false,
      status: 'ACTIVE',
      passwordCredential: makeCredential(),
      ...overrides,
    });
  }

  describe('UserModel.create (신규 가입)', () => {
    it('주어진 속성으로 사용자를 생성한다', () => {
      const cred = makeCredential();
      const user = UserModel.create({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        email: 'john@example.com',
        phone: '010-1234-5678',
        passwordCredential: cred,
      });

      expect(user.id).toBe('user-1');
      expect(user.tenantId).toBe('tenant-1');
      expect(user.username).toBe('john');
      expect(user.email).toBe('john@example.com');
      expect(user.phone).toBe('010-1234-5678');
    });

    it('초기 상태는 ACTIVE이다', () => {
      const user = UserModel.create({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      expect(user.status).toBe('ACTIVE');
    });

    it('이메일/전화 인증 상태는 false로 초기화된다', () => {
      const user = UserModel.create({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      expect(user.emailVerified).toBe(false);
      expect(user.phoneVerified).toBe(false);
    });

    it('username 앞뒤 공백을 제거한다', () => {
      const user = UserModel.create({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: '  john  ',
        passwordCredential: makeCredential(),
      });

      expect(user.username).toBe('john');
    });

    it('email과 phone이 없으면 null로 설정된다', () => {
      const user = UserModel.create({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'john',
        passwordCredential: makeCredential(),
      });

      expect(user.email).toBeNull();
      expect(user.phone).toBeNull();
    });
  });

  describe('UserModel.of (DB 로드)', () => {
    it('지정한 속성 그대로 복원된다', () => {
      const user = makeActiveUser({ status: 'LOCKED', emailVerified: true });

      expect(user.status).toBe('LOCKED');
      expect(user.emailVerified).toBe(true);
    });
  });

  describe('withdraw', () => {
    it('호출하면 status가 WITHDRAWN이 된다', () => {
      const user = makeActiveUser();

      user.withdraw();

      expect(user.status).toBe('WITHDRAWN');
    });

    it('이미 WITHDRAWN 상태면 예외가 발생한다', () => {
      const user = makeActiveUser({ status: 'WITHDRAWN' });

      expect(() => user.withdraw()).toThrow();
    });
  });

  describe('changePassword', () => {
    it('getPasswordCredential()로 현재 credential을 얻는다', () => {
      const user = makeActiveUser();
      const cred = user.getPasswordCredential();

      expect(cred).toBeTruthy();
    });

    it('새 credential로 교체된다', () => {
      const user = makeActiveUser();
      const newCred = UserCredentialModel.password({
        secretHash: 'new-hash',
        hashAlg: 'argon2id',
        hashParams: null,
        hashVersion: 1,
      });

      user.changePassword(newCred);

      expect(user.getPasswordCredential()).toBe(newCred);
    });

    it('WITHDRAWN 상태면 예외가 발생한다', () => {
      const user = makeActiveUser({ status: 'WITHDRAWN' });
      const newCred = UserCredentialModel.password({
        secretHash: 'new-hash',
        hashAlg: 'argon2id',
        hashParams: null,
        hashVersion: 1,
      });

      expect(() => user.changePassword(newCred)).toThrow();
    });
  });
});
