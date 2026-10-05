export abstract class IdentityUnlinkPort {
  // Locks the owning user before counting viable primary login methods and deleting.
  abstract remove(
    tenantId: string,
    userId: string,
    identityId: string,
  ): Promise<void>;
}
