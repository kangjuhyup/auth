import { PersistenceModel } from './persistence-model';

interface RoleModelProps {
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
}

export class RoleModel extends PersistenceModel<string, RoleModelProps> {
  constructor(props: RoleModelProps, id?: string) {
    super(props, id);
  }

  get tenantId(): string {
    return this.etc.tenantId;
  }

  get code(): string {
    return this.etc.code;
  }

  get name(): string {
    return this.etc.name;
  }

  get description(): string | null | undefined {
    return this.etc.description;
  }

  changeName(name: string): void {
    this.etc.name = name;
  }

  changeDescription(description: string | null): void {
    this.etc.description = description;
  }
}
