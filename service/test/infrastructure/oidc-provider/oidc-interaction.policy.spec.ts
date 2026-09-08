import { buildOidcInteractionPolicy } from '@infrastructure/oidc-provider/oidc-interaction.policy';

describe('buildOidcInteractionPolicy', () => {
  it('표준 prompt=create를 login보다 먼저 처리한다', () => {
    class Prompt {
      constructor(readonly config: { name: string; requestable?: boolean }) {}

      get name() {
        return this.config.name;
      }

      get requestable() {
        return this.config.requestable ?? false;
      }
    }
    const policy = Object.assign(
      [new Prompt({ name: 'login' }), new Prompt({ name: 'consent' })],
      {
        add(prompt: Prompt, index = policy.length) {
          policy.splice(index, 0, prompt);
        },
      },
    );
    const runtime = {
      base: () => policy,
      Prompt,
    } as any;

    const result = buildOidcInteractionPolicy(runtime);

    expect(result.map((prompt) => prompt.name)).toEqual([
      'create',
      'login',
      'consent',
    ]);
    expect(result[0].requestable).toBe(true);
  });
});
