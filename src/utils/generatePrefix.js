/**
 * 프로젝트명에서 자동 접두어를 생성한다.
 *
 * 규칙:
 * - 한글이 첫 의미있는 글자: 첫 한글 음절 1자
 * - 영문: 첫 단어의 자음 위주 2-3자 (모음 제거)
 * - 숫자/기호로 시작: 'x' + 안의 글자 일부
 * - 길이는 최소 1자, 최대 3자
 */
export function generatePrefix(name) {
  if (!name) return 'x'
  const trimmed = name.trim()
  if (!trimmed) return 'x'

  // 첫 한글 음절 찾기
  const koreanMatch = trimmed.match(/[\uAC00-\uD7AF]/)
  if (koreanMatch) {
    return koreanMatch[0]
  }

  // 영문 처리
  const englishMatch = trimmed.match(/[a-zA-Z]+/)
  if (englishMatch) {
    const word = englishMatch[0].toLowerCase()
    // 자음만 추출 (단, 첫 글자는 자음/모음 무관 유지)
    let consonants = word[0]
    for (let i = 1; i < word.length && consonants.length < 3; i++) {
      const c = word[i]
      if (!/[aeiou]/.test(c)) {
        consonants += c
      }
    }
    if (consonants.length < 2 && word.length >= 2) {
      // 자음이 너무 적으면 그냥 앞 2-3자 사용
      return word.slice(0, Math.min(3, word.length))
    }
    return consonants
  }

  // 한글도 영문도 없으면 'x'
  return 'x'
}

/**
 * 기존 접두어와 충돌하지 않도록 고유 접두어 생성.
 * @param {string} candidate
 * @param {string[]} existingPrefixes
 * @returns {string}
 */
export function ensureUniquePrefix(candidate, existingPrefixes) {
  if (!existingPrefixes.includes(candidate)) return candidate
  // 충돌 시 숫자 붙이기
  for (let i = 2; i <= 99; i++) {
    const cand = candidate + i
    if (!existingPrefixes.includes(cand)) return cand
  }
  // 그래도 안 되면 랜덤
  return candidate + Math.floor(Math.random() * 1000)
}
