import { MikroORM } from '@mikro-orm/core';
import { buildMikroOrmConfig } from '@infrastructure/mikro-orm/config/mikro-orm.config';
import { EventOrmEntity } from '@infrastructure/mikro-orm/entities/event';

describe.each(['postgresql', 'mysql', 'mssql'] as const)(
  'event audit persistence boundaries: %s',
  (driver) => {
    it('공통 event metadata가 감사 필드 저장 한도를 유지한다', async () => {
      const orm = await MikroORM.init({
        ...buildMikroOrmConfig({
          get: (key: string) =>
            key === 'DB_DRIVER'
              ? driver
              : key === 'MIKRO_ORM_LOGGER'
                ? 'silent'
                : undefined,
        }),
        connect: false,
      });

      const metadata = orm.getMetadata().get(EventOrmEntity);
      expect(metadata.properties.resourceId.length).toBe(191);
      expect(metadata.properties.userAgent.length).toBe(255);
      expect(metadata.properties.correlationId.length).toBe(128);
      expect(metadata.properties.ip.type).toBe('blob');
    });
  },
);
