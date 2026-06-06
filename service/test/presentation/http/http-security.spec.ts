import helmet from 'helmet';
import { applyHttpSecurityMiddleware } from '@presentation/http/http-security';

jest.mock('helmet', () => jest.fn((options) => ({ name: 'helmet', options })));

describe('applyHttpSecurityMiddleware', () => {
  function makeApp() {
    return {
      disable: jest.fn(),
      set: jest.fn(),
      use: jest.fn(),
    } as any;
  }

  function makeConfig(values: Record<string, string | undefined>) {
    return {
      get: jest.fn(
        (key: string, defaultValue?: string) => values[key] ?? defaultValue,
      ),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('x-powered-by를 제거하고 trust proxy hop을 설정한다', () => {
    const app = makeApp();
    const config = makeConfig({
      HTTP_TRUST_PROXY_HOPS: '2',
      HTTP_HELMET_ENABLED: 'false',
    });

    applyHttpSecurityMiddleware(app, config);

    expect(app.disable).toHaveBeenCalledWith('x-powered-by');
    expect(app.set).toHaveBeenCalledWith('trust proxy', 2);
    expect(app.use).not.toHaveBeenCalled();
  });

  it('trust proxy 0은 false로 설정한다', () => {
    const app = makeApp();
    const config = makeConfig({
      HTTP_TRUST_PROXY_HOPS: '0',
      HTTP_HELMET_ENABLED: 'false',
    });

    applyHttpSecurityMiddleware(app, config);

    expect(app.set).toHaveBeenCalledWith('trust proxy', false);
  });

  it('잘못된 trust proxy 값은 무시하고 helmet을 적용한다', () => {
    const app = makeApp();
    const config = makeConfig({
      HTTP_TRUST_PROXY_HOPS: 'not-a-number',
      HTTP_HSTS_ENABLED: 'true',
      HTTP_HSTS_MAX_AGE_SEC: '31536000',
    });

    applyHttpSecurityMiddleware(app, config);

    expect(app.set).not.toHaveBeenCalled();
    expect(helmet).toHaveBeenCalledWith(
      expect.objectContaining({
        hsts: expect.objectContaining({ maxAge: 31536000 }),
      }),
    );
    expect(app.use).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'helmet' }),
    );
  });
});
