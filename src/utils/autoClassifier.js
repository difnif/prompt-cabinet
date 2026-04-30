// 자동 분류 알고리즘
// 키워드 매칭 → 점수 계산 → 카테고리 결정 → 작은 그룹 합치기

import { CATEGORIES, TOPIC_CATEGORIES, MODIFIER_CATEGORIES } from './keywordDictionary';

// ───────────────────────────────────────────
// 정규식 캐시 (한 번만 컴파일)
// ───────────────────────────────────────────
const KEYWORD_REGEX_CACHE = (() => {
  const cache = {};
  for (const [catId, cat] of Object.entries(CATEGORIES)) {
    const englishKws = [];
    const otherKws = [];
    for (const kw of cat.keywords) {
      const lower = kw.toLowerCase();
      if (/^[a-z0-9 \-']+$/.test(lower)) {
        englishKws.push(lower);
      } else {
        otherKws.push(lower);
      }
    }
    // 영어 키워드는 단어 경계 매칭 (한 번에)
    // 멀티워드 키워드도 그대로 처리됨 ('hot air balloon' 등)
    const escaped = englishKws
      .map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length); // 긴 것부터 매칭 ('cherry blossom'이 'cherry'보다 먼저)
    cache[catId] = {
      englishRegex: escaped.length > 0
        ? new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
        : null,
      otherKws, // 한국어 등은 includes로 따로
    };
  }
  return cache;
})();

// ───────────────────────────────────────────
// 텍스트 → 카테고리별 점수
// ───────────────────────────────────────────
function scoreText(text) {
  if (!text || typeof text !== 'string') return {};
  const lower = text.toLowerCase();
  const scores = {};

  for (const catId of Object.keys(CATEGORIES)) {
    const { englishRegex, otherKws } = KEYWORD_REGEX_CACHE[catId];
    let score = 0;

    // 영어 키워드 매칭
    if (englishRegex) {
      const matches = lower.match(englishRegex);
      if (matches) score += matches.length * 2;
    }

    // 한국어/특수문자 키워드 매칭
    for (const kw of otherKws) {
      if (lower.includes(kw)) score += 2;
    }

    if (score > 0) scores[catId] = score;
  }

  return scores;
}

// ───────────────────────────────────────────
// 셀 하나 분류
// 정책 (subject-first 가정):
//   1) 텍스트에서 가장 먼저 등장하는 매치 키워드의 카테고리를 찾음 = subject 후보
//   2) subject 후보 카테고리에 +10 보너스
//   3) 점수 합산 후 1위 카테고리 선택 (동점 시 TOPIC > MODIFIER 순)
//
// 예: "fluffy puppy in autumn forest"
//   - 첫 매치: puppy (animal) → animal 보너스 +10
//   - animal=2+10=12, nature=4 → 동물 ✓
// 예: "watercolor cat"
//   - 첫 매치: watercolor (artstyle) → artstyle 보너스 +10
//   - 사용자 의도가 스타일 분류일 가능성 높음
// ───────────────────────────────────────────
const FIRST_MATCH_BONUS = 10;
const MIN_CONFIDENCE = 2;

// 텍스트에서 가장 먼저 등장하는 매치 키워드의 TOPIC 카테고리만 찾기
// (modifier는 보통 형용사 수식어이므로 subject 후보에서 제외)
// 같은 인덱스에서 매치되면 더 긴 매치 우선 ('cherry blossom' > 'cherry')
function findFirstTopicMatchCategory(lower) {
  let bestIdx = Infinity;
  let bestLen = 0;
  let bestCat = null;

  const updateBest = (idx, len, catId) => {
    if (idx < bestIdx || (idx === bestIdx && len > bestLen)) {
      bestIdx = idx;
      bestLen = len;
      bestCat = catId;
    }
  };

  for (const catId of TOPIC_CATEGORIES) {
    const { englishRegex, otherKws } = KEYWORD_REGEX_CACHE[catId];
    if (englishRegex) {
      englishRegex.lastIndex = 0;
      const m = englishRegex.exec(lower);
      if (m) updateBest(m.index, m[0].length, catId);
    }
    for (const kw of otherKws) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) updateBest(idx, kw.length, catId);
    }
  }
  return bestCat;
}

function classifyCell(cell) {
  const text = cell.prompt || cell.text || cell.content || '';
  if (!text) return { category: null, confidence: 0 };

  const lower = text.toLowerCase();
  const scores = scoreText(text);

  if (Object.keys(scores).length === 0) {
    return { category: null, confidence: 0 };
  }

  // subject 후보(첫 TOPIC 매치 카테고리)에 보너스
  const firstCat = findFirstTopicMatchCategory(lower);
  const adjusted = { ...scores };
  if (firstCat && adjusted[firstCat]) {
    adjusted[firstCat] += FIRST_MATCH_BONUS;
  }

  // 1위 카테고리 (TOPIC > MODIFIER 순서, 동점 시 앞 우선)
  let best = null;
  let bestScore = 0;
  for (const catId of [...TOPIC_CATEGORIES, ...MODIFIER_CATEGORIES]) {
    if (adjusted[catId] && adjusted[catId] > bestScore) {
      bestScore = adjusted[catId];
      best = catId;
    }
  }

  if (best && bestScore >= MIN_CONFIDENCE) {
    return { category: best, confidence: bestScore };
  }

  return { category: null, confidence: 0 };
}

// ───────────────────────────────────────────
// 프로젝트 전체 분류
// minGroupSize 미만 그룹은 unclassified로 합쳐서 원본에 남김
// ───────────────────────────────────────────
export function classifyCells(cells, options = {}) {
  const minGroupSize = options.minGroupSize ?? 50; // 50개 미만 그룹은 unclassified
  const groupsMap = {};
  const unclassified = [];

  for (const cell of cells) {
    const { category, confidence } = classifyCell(cell);
    if (category) {
      if (!groupsMap[category]) {
        groupsMap[category] = {
          id: category,
          label: CATEGORIES[category].label,
          prefix: CATEGORIES[category].prefix,
          cells: [],
          totalConfidence: 0,
        };
      }
      groupsMap[category].cells.push(cell);
      groupsMap[category].totalConfidence += confidence;
    } else {
      unclassified.push(cell);
    }
  }

  // minGroupSize 이하 그룹은 unclassified로
  const finalGroups = [];
  for (const group of Object.values(groupsMap)) {
    if (group.cells.length >= minGroupSize) {
      finalGroups.push(group);
    } else {
      unclassified.push(...group.cells);
    }
  }

  // 큰 그룹부터 정렬
  finalGroups.sort((a, b) => b.cells.length - a.cells.length);

  return {
    groups: finalGroups,
    unclassified,
    stats: {
      totalCells: cells.length,
      classifiedCells: cells.length - unclassified.length,
      unclassifiedCells: unclassified.length,
      groupCount: finalGroups.length,
      classificationRate: cells.length > 0
        ? Math.round(((cells.length - unclassified.length) / cells.length) * 100)
        : 0,
    },
  };
}

// ───────────────────────────────────────────
// 새 프로젝트 정보 생성 (이름·접두어 충돌 처리)
// ───────────────────────────────────────────
export function generateGroupProjectInfo(group, sourceProjectName, existingPrefixes, existingNames) {
  // 이름: '원본명-카테고리라벨', 충돌 시 숫자 붙이기
  let name = `${sourceProjectName}-${group.label}`;
  let nameSuffix = 2;
  while (existingNames.has(name)) {
    name = `${sourceProjectName}-${group.label}-${nameSuffix}`;
    nameSuffix++;
  }

  // 접두어: 기본 prefix, 충돌 시 라벨 첫 글자, 그래도 충돌이면 숫자
  let prefix = group.prefix;
  if (existingPrefixes.has(prefix)) {
    const firstChar = group.label.charAt(0);
    if (!existingPrefixes.has(firstChar)) {
      prefix = firstChar;
    } else {
      let i = 2;
      while (existingPrefixes.has(`${prefix}${i}`)) i++;
      prefix = `${prefix}${i}`;
    }
  }

  return { name, prefix };
}
