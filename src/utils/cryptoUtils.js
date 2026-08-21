/**
 * Cryptographically secure random helpers for browsers & client code
 */

export function getRandomInt(min, max) {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const array = new Uint32Array(1)
    window.crypto.getRandomValues(array)
    return min + (array[0] % (max - min))
  }
  return Math.floor(Math.random() * (max - min)) + min
}

export function getRandomString(length = 8) {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length)
    window.crypto.getRandomValues(bytes)
    return Array.from(bytes, b => (b % 36).toString(36)).join('')
  }
  return Math.random().toString(36).slice(2, 2 + length)
}

export function getRandomCode(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length)
    window.crypto.getRandomValues(bytes)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(bytes[i] % chars.length)
    }
    return result
  }
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
