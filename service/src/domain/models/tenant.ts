import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';

interface TenantModelProps {
  code: string;
  name: string;
}

export class TenantModel extends PersistenceModel<string, TenantModelProps> {
  constructor(props: TenantModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly code: string;

  @Getter()
  declare readonly name: string;

  changeName(name: string): void {
    this.etc.name = name;
  }
}
