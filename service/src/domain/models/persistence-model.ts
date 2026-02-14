export abstract class PersistenceModel<PK, PERSISTENCE_PROPS> {
  protected etc: PERSISTENCE_PROPS;

  #id!: PK;
  #createdAt!: Date;
  #updatedAt!: Date;

  protected constructor(etc: PERSISTENCE_PROPS, id?: PK) {
    this.etc = etc;
    if (id !== undefined) {
      this.#id = id;
    }
  }

  get id(): PK {
    return this.#id;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get updatedAt(): Date {
    return this.#updatedAt;
  }

  setPersistence(id: PK, createdAt: Date, updatedAt: Date): this {
    this.#id = id;
    this.#createdAt = createdAt;
    this.#updatedAt = updatedAt;
    return this;
  }
}
