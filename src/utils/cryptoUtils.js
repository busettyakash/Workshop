/**
 * Cryptographically secure random helpers using Web Crypto API
 */

function getCryptoRandomBytes(length) {
  const bytes = new Uint8Array(length)
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes)
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  }
  return bytes
}

export function getRandomInt(min, max) {
  const bytes = getCryptoRandomBytes(4)
  const view = new DataView(bytes.buffer)
  const uint32 = view.getUint32(0, true)
  return min + (uint32 % (max - min))
}

export function getRandomString(length = 8) {
  const bytes = getCryptoRandomBytes(length)
  return Array.from(bytes, b => (b % 36).toString(36)).join('')
}

export function getRandomCode(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  const bytes = getCryptoRandomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length)
  }
  return result
}
