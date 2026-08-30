export interface BootstrapMainDependencies {
  readonly run: () => Promise<number>;
  readonly exit: (code: number) => void;
}

export async function runBootstrapMain(
  dependencies: BootstrapMainDependencies,
): Promise<void> {
  let exitCode = 1;
  try {
    exitCode = (await dependencies.run()) === 0 ? 0 : 1;
  } catch {
    exitCode = 1;
  }
  dependencies.exit(exitCode);
}
