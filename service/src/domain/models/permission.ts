import { PersistenceModel } from './persistence-model';

interface PermissionModelProps {
  tenantId: string;
  code: string;
  resource?: string | null;
  action?: string | null;
  description?: string | null;
}

export class PermissionModel extends PersistenceModel<string, PermissionModelProps> {
  constructor(props: PermissionModelProps, id?: string) {
    super(props, id);
  }

  get tenantId(): string {
    return this.etc.tenantId;
  }

  get code(): string {
    return this.etc.code;
  }

  get resource(): string | null | undefined {
    return this.etc.resource;
  }

  get action(): string | null | undefined {
    return this.etc.action;
  }

  get description(): string | null | undefined {
    return this.etc.description;
  }

  changeResource(resource: string | null): void {
    this.etc.resource = resource;
  }

  changeAction(action: string | null): void {
    this.etc.action = action;
  }

  changeDescription(description: string | null): void {
    this.etc.description = description;
  }
}
