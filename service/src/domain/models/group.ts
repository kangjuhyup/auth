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

  get tenantId(): string {
    return this.etc.tenantId;
  }

  get code(): string {
    return this.etc.code;
  }

  get name(): string {
    return this.etc.name;
  }

  get parentId(): string | null | undefined {
    return this.etc.parentId;
  }

  changeName(name: string): void {
    this.etc.name = name;
  }

  changeParent(parentId: string | null): void {
    this.etc.parentId = parentId;
  }
}
