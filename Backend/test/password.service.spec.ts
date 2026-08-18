import { PasswordService } from '../src/auth/password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes passwords with Argon2id and never returns plaintext', async () => {
    const password = 'Strong hotel password 2026!';
    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(service.verify(hash, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password without throwing', async () => {
    const hash = await service.hash('Correct hotel password 2026!');
    await expect(service.verify(hash, 'Incorrect password 2026!')).resolves.toBe(false);
  });
});
