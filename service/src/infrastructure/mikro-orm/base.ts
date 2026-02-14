import { Property } from '@mikro-orm/core';

export abstract class BaseEntity {
  @Property({
    fieldName: 'created_at',
    type: 'datetime',
    onCreate: () => new Date(),
  })
  createdAt?: Date;

  @Property({
    fieldName: 'updated_at',
    type: 'datetime',
    onUpdate: () => new Date(),
  })
  updatedAt?: Date;
}
