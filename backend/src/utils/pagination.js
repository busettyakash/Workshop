/**
 * Pagination Utility for Node.js + PostgreSQL
 * Supports both Keyset (Cursor-based) and Offset-based pagination safely.
 */

export function encodeCursor(payload) {
  try {
    return Buffer.from(JSON.stringify(payload)).toString('base64')
  } catch {
    return null
  }
}

export function decodeCursor(cursorStr) {
  if (!cursorStr) return null
  try {
    const decoded = Buffer.from(cursorStr, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export function parsePaginationParams(query, defaultLimit = 20, maxLimit = 100) {
  const pageRaw = parseInt(query.page, 10)
  const limitRaw = parseInt(query.limit, 10)

  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const limit = isNaN(limitRaw) || limitRaw < 1 ? defaultLimit : Math.min(limitRaw, maxLimit)
  const offset = (page - 1) * limit
  const cursor = query.cursor ? decodeCursor(query.cursor) : null

  return { page, limit, offset, cursor }
}
