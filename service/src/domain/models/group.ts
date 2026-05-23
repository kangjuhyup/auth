import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';

interface GroupModelProps {
  tenantId: string;
  code: string;
  name: string;
  parentId?: string | null;
}

export class GroupModel extends PersistenceModel<string, GroupModelProps> {
  constructor(props: GroupModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly code: string;

  @Getter()
  declare readonly name: string;

  @Getter()
  declare readonly parentId: string | null | undefined;

  changeName(name: string): void {
    this.etc.name = name;
  }

  changeParent(parentId: string | null): void {
    this.etc.parentId = parentId;
  }
}
