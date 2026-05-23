import { Getter, Setter } from '@domain/decorators';
import { PersistenceModel } from '@domain/models';

interface TestProps {
  name: string;
  email: string | null;
  enabled: boolean;
}

class TestModel extends PersistenceModel<string, TestProps> {
  private constructor(props: TestProps) {
    super(props, 'test-id');
  }

  static of(props: TestProps): TestModel {
    return new TestModel(props);
  }

  @Getter()
  declare readonly name: string;

  @Getter('enabled')
  declare readonly active: boolean;

  @Getter()
  @Setter()
  declare email: string | null;
}

class InvalidAccessorTarget {
  @Getter()
  declare readonly name: string;
}

class PropsBackedTestModel {
  private readonly props: { name: string };

  constructor(props: { name: string }) {
    this.props = props;
  }

  @Getter()
  declare readonly name: string;
}

describe('domain accessor decorators', () => {
  it('props의 같은 이름 값을 getter로 노출한다', () => {
    const model = TestModel.of({
      name: 'auth',
      email: 'auth@example.com',
      enabled: true,
    });

    expect(model.name).toBe('auth');
  });

  it('명시한 props key를 다른 이름 getter로 노출한다', () => {
    const model = TestModel.of({
      name: 'auth',
      email: 'auth@example.com',
      enabled: true,
    });

    expect(model.active).toBe(true);
  });

  it('setter로 props 값을 갱신한다', () => {
    const model = TestModel.of({
      name: 'auth',
      email: 'auth@example.com',
      enabled: true,
    });

    model.email = 'changed@example.com';

    expect(model.email).toBe('changed@example.com');
  });

  it('props 필드를 사용하는 도메인 모델에서도 getter로 값을 노출한다', () => {
    const model = new PropsBackedTestModel({ name: 'props-model' });

    expect(model.name).toBe('props-model');
  });

  it('도메인 props가 없는 대상에서는 명시적으로 실패한다', () => {
    const target = new InvalidAccessorTarget();

    expect(() => target.name).toThrow('DomainAccessorPropsNotFound:name');
  });
});
