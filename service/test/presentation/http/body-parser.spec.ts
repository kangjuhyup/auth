import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import { json, urlencoded } from 'express';
import { configureBodyParsers } from '@presentation/http/body-parser';

jest.mock('express', () => ({
  json: jest.fn(),
  urlencoded: jest.fn(),
}));

function createMockApp(): Pick<NestExpressApplication, 'use'> {
  return {
    use: jest.fn(),
  };
}

function createParserMock(): jest.MockedFunction<RequestHandler> {
  return jest.fn((_, __, next) => next());
}

describe('configureBodyParsers', () => {
  let jsonParser: jest.MockedFunction<RequestHandler>;
  let urlencodedParser: jest.MockedFunction<RequestHandler>;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonParser = createParserMock();
    urlencodedParser = createParserMock();

    (json as jest.Mock).mockReturnValue(jsonParser);
    (urlencoded as jest.Mock).mockReturnValue(urlencodedParser);
  });

  it('JSON과 urlencoded 파서를 앱에 등록한다', () => {
    const app = createMockApp();

    configureBodyParsers(app as NestExpressApplication);

    expect(json).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith();
    expect(urlencoded).toHaveBeenCalledTimes(1);
    expect(urlencoded).toHaveBeenCalledWith({ extended: false });
    expect(app.use).toHaveBeenCalledTimes(2);
  });

  it('OIDC 경로에서는 실제 파서를 건너뛰고 next를 호출한다', () => {
    const app = createMockApp();

    configureBodyParsers(app as NestExpressApplication);

    const jsonMiddleware = (app.use as jest.Mock).mock.calls[0][0] as RequestHandler;
    const urlencodedMiddleware = (app.use as jest.Mock).mock.calls[1][0] as RequestHandler;
    const req = { path: '/t/acme/oidc/token' } as any;
    const res = {} as any;
    const next = jest.fn();

    jsonMiddleware(req, res, next);
    urlencodedMiddleware(req, res, next);

    expect(jsonParser).not.toHaveBeenCalled();
    expect(urlencodedParser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('OIDC가 아닌 경로에서는 등록된 파서를 실행한다', () => {
    const app = createMockApp();

    configureBodyParsers(app as NestExpressApplication);

    const jsonMiddleware = (app.use as jest.Mock).mock.calls[0][0] as RequestHandler;
    const urlencodedMiddleware = (app.use as jest.Mock).mock.calls[1][0] as RequestHandler;
    const req = { path: '/admin/session' } as any;
    const res = {} as any;
    const next = jest.fn();

    jsonMiddleware(req, res, next);
    urlencodedMiddleware(req, res, next);

    expect(jsonParser).toHaveBeenCalledWith(req, res, next);
    expect(urlencodedParser).toHaveBeenCalledWith(req, res, next);
  });
});
