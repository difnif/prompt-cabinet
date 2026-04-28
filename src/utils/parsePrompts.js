// 프롬프트 텍스트 파싱 유틸

const BULLET_PATTERN = /^\s*(?:\d+[.)]|\(\d+\)|[-•*→]|#+)\s+/

const HEADER_KEYS_NAME = ['프로젝트명', 'project', 'name', '제목']
const HEADER_KEYS_PREFIX = ['접두어', 'prefix']

function stripBullet(line) {
  return line.replace(BULLET_PATTERN, '').trim()
}

function parseHeaderLine(line) {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const key = line.slice(0, colonIdx).trim().toLowerCase()
  const value = line.slice(colonIdx + 1).trim()
  if (!value) return null
  if (HEADER_KEYS_NAME.some((h) => key === h.toLowerCase())) {
    return { type: 'name', value }
  }
  if (HEADER_KEYS_PREFIX.some((h) => key === h.toLowerCase())) {
    return { type: 'prefix', value }
  }
  return null
}

function looksLikeHeader(line) {
  return parseHeaderLine(line) !== null
}

/**
 * 텍스트 첫 블록에서 헤더(프로젝트명/접두어) 추출.
 */
export function extractHeaders(raw) {
  if (!raw || !raw.trim()) return { name: null, prefix: null }
  const blocks = raw.split(/\n\s*\n+/)
  if (blocks.length === 0) return { name: null, prefix: null }
  const firstBlock = blocks[0]
  const lines = firstBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  let name = null
  let prefix = null
  for (const l of lines) {
    const h = parseHeaderLine(l)
    if (!h) continue
    if (h.type === 'name' && !name) name = h.value
    if (h.type === 'prefix' && !prefix) prefix = h.value
  }
  return { name, prefix }
}

/**
 * 텍스트를 프롬프트 배열로 변환.
 */
export function parsePrompts(raw) {
  if (!raw || !raw.trim()) return []

  const blocks = raw.split(/\n\s*\n+/)

  const prompts = []
  let firstBlockChecked = false

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) continue

    if (!firstBlockChecked) {
      firstBlockChecked = true
      const allHeader = lines.every((l) => looksLikeHeader(l))
      if (allHeader) continue
    }

    const cleaned = lines.filter((l) => !looksLikeHeader(l)).map(stripBullet)
    if (cleaned.length === 0) continue

    const text = cleaned.join(' ').trim()
    if (text.length === 0) continue

    prompts.push(text)
  }

  return prompts
}
