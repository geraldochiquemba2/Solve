/**
 * Aleatoriedade criptográfica para o browser.
 *
 * `Math.random()` não é CSPRNG: a semente é previsível e o gerador não resiste
 * a ataque de força bruta do estado. Para chaves de React, ids de fallback e
 * qualquer valor que não possa ser adivinhado, usar `crypto.getRandomValues`.
 */

/** Inteiro seguro aleatório em [0, max). */
export function randomInt(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const limit = Math.floor(max);
  if (limit <= 1) return 0;
  // Rejeição: % intro bias quando limit não divide 2^32.
  const range = 0x100000000;
  const ceiling = range - (range % limit);
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= ceiling);
  return value % limit;
}

/** Id curto aleatório, com o mesmo formato de `Math.random().toString(36)`. */
export function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}
