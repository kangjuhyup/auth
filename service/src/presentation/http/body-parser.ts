import { json, urlencoded } from 'express';
import type { Request, RequestHandler } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

const OIDC_ROUTE_PATTERN = /^\/t\/[^/]+\/oidc(?:\/|$)/;

function isOidcRoute(req: Request): boolean {
  return OIDC_ROUTE_PATTERN.test(req.path);
}

function unlessOidcRoute(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (isOidcRoute(req)) {
      next();
      return;
    }

    middleware(req, res, next);
  };
}

export function configureBodyParsers(app: NestExpressApplication): void {
  app.use(unlessOidcRoute(json()));
  app.use(unlessOidcRoute(urlencoded({ extended: false })));
}
