import { AuditRecorder } from '@application/services/audit-recorder';
import type { EventRepository } from '@domain/repositories';
import { EventModel } from '@domain/models/event';

function createEventRepo(): jest.Mocked<EventRepository> {
  return {
    list: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuditRecorder', () => {
  it('관리자 작업을 EventModel로 저장한다', async () => {
    const eventRepo = createEventRepo();
    const recorder = new AuditRecorder(eventRepo);

    await recorder.recordAdminAction({
      tenantId: 'tenant-1',
      action: 'UPDATE',
      resourceType: 'client',
      resourceId: 'client-1',
      metadata: { changedFields: ['name'] },
      correlationId: 'req-1',
    });

    expect(eventRepo.save).toHaveBeenCalledWith(expect.any(EventModel));
    const event = eventRepo.save.mock.calls[0][0];
    expect(event.tenantId).toBe('tenant-1');
    expect(event.category).toBe('SYSTEM');
    expect(event.action).toBe('UPDATE');
    expect(event.resourceType).toBe('client');
    expect(event.resourceId).toBe('client-1');
    expect(event.correlationId).toBe('req-1');
    expect(event.metadata).toEqual({ changedFields: ['name'] });
  });
});
