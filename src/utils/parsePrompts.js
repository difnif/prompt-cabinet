// 프롬프트 텍스트 파싱 유틸

const BULLET_PATTERN = /^\s*(?:\d+[.)]|\(\d+\)|[-•*→]|#+)\s+/

const HEADER_KEYS = ['프로젝트명', '접두어', 'project', 'prefix']

function stripBullet(line) {
  return line.replace(BULLET_PATTERN, '').trim()
}

function looksLikeHeader(line) {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return false
  const key = line.slice(0, colonIdx).trim().toLowerCase()
  return HEADER_KEYS.some((h) => key === h.toLowerCase())
}

/**
 * 텍스트를 프롬프트 배열로 변환.
 * - 빈 줄로 블록 분리
 * - 앞 번호/불릿 제거
 * - 첫 블록이 헤더(프로젝트명/접두어)면 drop
 * - 빈 블록 skip
 */
export function parsePrompts(raw) {
  if (!raw || !raw.trim()) return []

  // 빈 줄(공백만 있는 줄 포함)로 블록 분리
  const blocks = raw.split(/\n\s*\n+/)

  const prompts = []
  let firstBlockChecked = false

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) continue

    // 첫 블록이 헤더 라인들만 있으면 통째로 skip
    if (!firstBlockChecked) {
      firstBlockChecked = true
      const allHeader = lines.every((l) => looksLikeHeader(l))
      if (allHeader) continue
    }

    // 헤더 라인이 섞여있으면 해당 라인만 제거
    const cleaned = lines.filter((l) => !looksLikeHeader(l)).map(stripBullet)
    if (cleaned.length === 0) continue

    // 프롬프트는 한 줄로 합침 (여러 줄이면 공백으로 이어붙임)
    const text = cleaned.join(' ').trim()
    if (text.length === 0) continue

    prompts.push(text)
  }

  return prompts
}
