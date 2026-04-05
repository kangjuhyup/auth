jest.mock('@mikro-orm/core', () => {
  const actual = jest.requireActual('@mikro-orm/core');

  return {
    ...actual,
    ref: jest.fn((entity: unknown) => entity),
  };
});
