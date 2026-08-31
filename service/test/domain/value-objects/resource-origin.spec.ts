import { ResourceOrigin } from '@domain/value-objects/resource-origin';

describe('ResourceOrigin', () => {
  it('HTTPS resource URL을 origin으로 정규화한다', () => {
    expect(ResourceOrigin.of('https://api.example.com/orders?x=1').value).toBe(
      'https://api.example.com',
    );
  });

  it.each([
    'not-a-url',
    'http://api.example.com',
    'https://localhost:3000',
    'https://internal.local',
  ])('안전하지 않은 resource %s 를 거부한다', (resource) => {
    expect(() => ResourceOrigin.of(resource)).toThrow('InvalidResourceOrigin');
  });
});
