import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';

interface PermissionModelProps {
  tenantId: string;
  code: string;
  resource?: string | null;
  action?: string | null;
  description?: string | null;
}

export class PermissionModel extends PersistenceModel<
  string,
  PermissionModelProps
> {
  constructor(props: PermissionModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly code: string;

  @Getter()
  declare readonly resource: string | null | undefined;

  @Getter()
  declare readonly action: string | null | undefined;

  @Getter()
  declare readonly description: string | null | undefined;

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
