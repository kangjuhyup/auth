import {
  EVENT_STORE_PORT,
  EVENT_BUS_PORT,
  DOMAIN_EVENT_HANDLERS,
} from '@application/ports';
import { Module } from '@nestjs/common';
import { MikroEventStoreAdapter } from './mikro-event-store.adapter';
import { InProcessEventBusAdapter } from '../adapters/in-proccess-event-bus.adapter';
import { UserCreatedProjector } from '../projections/user/user-created.projection';
import { UserPasswordChangedProjector } from '@infrastructure/projections/user/user-password-changed.projection';
import { UserWithdrawnProjector } from '@infrastructure/projections/user/user-withdrawn.projection';

const projectors = [
  UserCreatedProjector,
  UserWithdrawnProjector,
  UserPasswordChangedProjector,
];

@Module({
  providers: [
    {
      provide: EVENT_STORE_PORT,
      useClass: MikroEventStoreAdapter,
    },
    {
      provide: DOMAIN_EVENT_HANDLERS,
      useFactory: (...handlers: any[]) => handlers,
      inject: projectors,
    },
    {
      provide: EVENT_BUS_PORT,
      useClass: InProcessEventBusAdapter,
    },
  ],
  exports: [EVENT_STORE_PORT, EVENT_BUS_PORT],
})
export class EventStoreModule {}
