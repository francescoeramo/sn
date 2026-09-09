import { it, expect } from 'vitest';
import { readLimited, BodyTooLarge } from '../lib/core/http';
it('limita il corpo effettivo anche senza Content-Length', async () => {
  const req = new Request('http://localhost', { method: 'POST', body: 'x'.repeat(21) });
  await expect(readLimited(req, 20)).rejects.toBeInstanceOf(BodyTooLarge);
});
it('legge JSON entro il limite', async () => {
  expect(
    new TextDecoder().decode(
      await readLimited(new Request('http://localhost', { method: 'POST', body: '{}' }), 20),
    ),
  ).toBe('{}');
});
