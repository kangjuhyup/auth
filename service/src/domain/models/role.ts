import { Getter } from '../decorators';
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

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly code: string;

  @Getter()
  declare readonly name: string;

  @Getter()
  declare readonly description: string | null | undefined;

  changeName(name: string): void {
    this.etc.name = name;
  }

  changeDescription(description: string | null): void {
    this.etc.description = description;
  }
}
