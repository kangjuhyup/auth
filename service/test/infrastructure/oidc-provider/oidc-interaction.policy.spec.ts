import { buildOidcInteractionPolicy } from '@infrastructure/oidc-provider/oidc-interaction.policy';

describe('buildOidcInteractionPolicy', () => {
  it('node-oidc-provider 기본 interaction policy를 그대로 사용한다', () => {
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

    expect(result).toBe(policy);
    expect(result.map((prompt) => prompt.name)).toEqual(['login', 'consent']);
  });
});
