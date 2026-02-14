import {
  EVENT_STORE_PORT,
  EVENT_BUS_PORT,
  DOMAIN_EVENT_HANDLERS,
} from '@application/command/ports';
import { Module } from '@nestjs/common';
import { MikroEventStoreAdapter } from './mikro-event-store.adapter';
import { InProcessEventBusAdapter } from '../adapters/in-proccess-event-bus.adapter';
import { UserCreatedProjector } from '../projections/user/user-created.projection';

@Module({
  providers: [
    {
      provide: EVENT_STORE_PORT,
      useClass: MikroEventStoreAdapter,
    },
    UserCreatedProjector,
    {
      provide: DOMAIN_EVENT_HANDLERS,
      useFactory: (userCreated: UserCreatedProjector) => [userCreated],
      inject: [UserCreatedProjector],
    },
    {
      provide: EVENT_BUS_PORT,
      useClass: InProcessEventBusAdapter,
    },
  ],
  exports: [EVENT_STORE_PORT, EVENT_BUS_PORT],
})
export class EventStoreModule {}
