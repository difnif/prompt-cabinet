/**
 * 식별어 입력을 파싱한다.
 *
 * 입력 예: "굿17 굿20-25 굿30"
 * 출력: ['굿17', '굿20', '굿21', '굿22', '굿23', '굿24', '굿25', '굿30']
 *
 * 작업 모드 다중 선택 + 명령 모드 입력 둘 다에서 사용.
 */

const TOKEN_RE = /^([^\d\s]+)(\d+)(?:-(\d+))?$/

/**
 * 식별어 토큰 하나를 파싱.
 * '굿17' → { prefix: '굿', start: 17, end: 17 }
 * '굿20-25' → { prefix: '굿', start: 20, end: 25 }
 */
export function parseIdentifierToken(token) {
  const m = token.trim().match(TOKEN_RE)
  if (!m) return null
  const [, prefix, startStr, endStr] = m
  const start = parseInt(startStr, 10)
  const end = endStr != null ? parseInt(endStr, 10) : start
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  if (end < start) return { prefix, start: end, end: start }
  return { prefix, start, end }
}

/**
 * 식별어 입력 텍스트를 풀어낸 식별어 배열로 변환.
 * 공백/콤마/줄바꿈 모두 구분자로 허용.
 */
export function expandIdentifiers(text) {
  if (!text) return []
  const tokens = text.split(/[\s,\n]+/).filter(Boolean)
  const out = []
  const seen = new Set()
  for (const tok of tokens) {
    const parsed = parseIdentifierToken(tok)
    if (!parsed) continue
    const padLen = (tok.match(/\d+/)?.[0]?.length) || 2
    for (let n = parsed.start; n <= parsed.end; n++) {
      const id = `${parsed.prefix}${String(n).padStart(padLen, '0')}`
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  return out
}

/**
 * 식별어 배열을 컴팩트한 표기로 압축.
 * ['굿17', '굿18', '굿19', '굿22', '굿25', '굿26']
 *  → '굿17-19 굿22 굿25-26'
 */
export function compactIdentifiers(identifiers) {
  if (!identifiers || identifiers.length === 0) return ''

  // prefix별로 그룹핑하면서 number 추출
  const byPrefix = new Map()
  for (const id of identifiers) {
    const m = id.match(/^([^\d]+)(\d+)$/)
    if (!m) continue
    const [, prefix, numStr] = m
    const num = parseInt(numStr, 10)
    const padLen = numStr.length
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, { padLen, nums: [] })
    byPrefix.get(prefix).nums.push(num)
  }

  const parts = []
  for (const [prefix, { padLen, nums }] of byPrefix) {
    nums.sort((a, b) => a - b)
    let start = nums[0]
    let prev = nums[0]
    for (let i = 1; i <= nums.length; i++) {
      const cur = nums[i]
      if (cur === prev + 1) {
        prev = cur
        continue
      }
      // 시퀀스 끝
      if (start === prev) {
        parts.push(`${prefix}${String(start).padStart(padLen, '0')}`)
      } else {
        parts.push(
          `${prefix}${String(start).padStart(padLen, '0')}-${String(prev).padStart(padLen, '0')}`
        )
      }
      start = cur
      prev = cur
    }
  }

  return parts.join(' ')
}
