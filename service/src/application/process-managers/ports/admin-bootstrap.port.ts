export interface AdminBootstrapInput {
  readonly username: string;
  readonly password?: string;
  readonly adminUiUrl: string;
  readonly legacyMigrationAdminUiUrl: string;
}

export abstract class AdminBootstrapPort {
  abstract bootstrap(input: AdminBootstrapInput): Promise<void>;
}
