export type RegistrationEligibilityErrorCode =
  | 'binding_conflict'
  | 'expired'
  | 'unavailable'
  | 'invalid_response';

export class RegistrationEligibilityError extends Error {
  constructor(readonly code: RegistrationEligibilityErrorCode) {
    super(`RegistrationEligibility:${code}`);
    this.name = 'RegistrationEligibilityError';
  }
}

export type RegistrationEligibilityClaim = Readonly<{
  registrationId: string;
  attemptId: string;
  status: 'CLAIMED';
  claimExpiresAt: string;
}>;

export type RegistrationEligibilityCompletion = Readonly<{
  registrationId: string;
  status: 'USED';
}>;

export abstract class RegistrationEligibilityPort {
  abstract claim(params: {
    handoffId: string;
    tenantId: string;
    clientId: string;
    attemptId: string;
  }): Promise<RegistrationEligibilityClaim>;

  abstract complete(params: {
    registrationId: string;
    attemptId: string;
    issuer: string;
    subject: string;
  }): Promise<RegistrationEligibilityCompletion>;
}
