import { PersistenceModel } from './persistence-model';

interface TenantModelProps {
  code: string;
  name: string;
}

export class TenantModel extends PersistenceModel<string, TenantModelProps> {
  constructor(props: TenantModelProps, id?: string) {
    super(props, id);
  }

  get code(): string {
    return this.etc.code;
  }

  get name(): string {
    return this.etc.name;
  }

  changeName(name: string): void {
    this.etc.name = name;
  }
}
