import { useState, useEffect, useMemo } from 'react';
import { classifyCells, generateGroupProjectInfo } from '../utils/autoClassifier';

/**
 * 자동 분류 다이얼로그
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   sourceProject: 분류할 원본 프로젝트
 *   cells: 그 프로젝트의 셀 배열
 *   allProjects: 전체 프로젝트 (이름·접두어 충돌 검사용)
 *   onExecute: async (plannedGroups, onProgress) => { projectsCreated, cellsMoved }
 *     - plannedGroups: [{ id, label, prefix, cells, newProjectName, newPrefix }, ...]
 *     - onProgress(current, label): 진행률 콜백
 *   minGroupSize: 기본 50 (이보다 작은 그룹은 unclassified로)
 */
export default function AutoClassifyDialog({
  isOpen,
  onClose,
  sourceProject,
  cells,
  allProjects = [],
  onExecute,
  minGroupSize = 50,
}) {
  // analyzing → ready → running → done → error
  const [phase, setPhase] = useState('analyzing');
  const [classification, setClassification] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 다이얼로그 열릴 때 분석 시작
  useEffect(() => {
    if (!isOpen) return;
    setPhase('analyzing');
    setClassification(null);
    setResult(null);
    setError(null);

    // 분석은 빠르지만 다음 tick에서 (UI 깜빡임 방지)
    const timer = setTimeout(() => {
      try {
        const r = classifyCells(cells, { minGroupSize });
        setClassification(r);
        setPhase('ready');
      } catch (e) {
        setError(e?.message || String(e));
        setPhase('error');
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, cells, minGroupSize]);

  // 기존 접두어/이름 set
  const existingPrefixes = useMemo(() => {
    const set = new Set();
    for (const p of allProjects) if (p?.prefix) set.add(p.prefix);
    return set;
  }, [allProjects]);

  const existingNames = useMemo(() => {
    const set = new Set();
    for (const p of allProjects) if (p?.name) set.add(p.name);
    return set;
  }, [allProjects]);

  const handleExecute = async () => {
    if (!classification || !onExecute) return;
    setPhase('running');
    setProgress({ current: 0, total: classification.groups.length, label: '준비 중...' });

    try {
      // 그룹별 새 프로젝트명/접두어 생성 (충돌 회피)
      const usedPrefixes = new Set(existingPrefixes);
      const usedNames = new Set(existingNames);
      const plannedGroups = classification.groups.map((g) => {
        const info = generateGroupProjectInfo(g, sourceProject.name, usedPrefixes, usedNames);
        usedPrefixes.add(info.prefix);
        usedNames.add(info.name);
        return { ...g, newProjectName: info.name, newPrefix: info.prefix };
      });

      const r = await onExecute(plannedGroups, (current, label) => {
        setProgress({ current, total: plannedGroups.length, label });
      });

      setResult(r || { projectsCreated: plannedGroups.length, cellsMoved: 0 });
      setPhase('done');
    } catch (e) {
      setError(e?.message || String(e));
      setPhase('error');
    }
  };

  if (!isOpen) return null;

  const canCloseByOverlay = phase !== 'running';

  return (
    <div
      className="dialog-overlay"
      onClick={canCloseByOverlay ? onClose : undefined}
    >
      <div className="dialog auto-classify-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>자동 분류 — {sourceProject?.name}</h3>

        {phase === 'analyzing' && (
          <div className="dialog-body">
            <p className="muted">셀 {cells.length}개 분석 중…</p>
          </div>
        )}

        {phase === 'ready' && classification && (
          <div className="dialog-body">
            <p>
              <strong>{classification.stats.totalCells}개</strong> 중{' '}
              <strong>{classification.stats.classifiedCells}개</strong> 분류 가능 (
              {classification.stats.classificationRate}%)
            </p>

            {classification.groups.length === 0 ? (
              <p className="warning">
                의미 있는 그룹이 발견되지 않았어요.
                <br />
                키워드 매칭이 약한 데이터일 수 있어요.
              </p>
            ) : (
              <>
                <p>
                  새 프로젝트 <strong>{classification.groups.length}개</strong>가 생성됩니다:
                </p>
                <ul className="classify-group-list">
                  {classification.groups.map((g) => (
                    <li key={g.id}>
                      <span className="classify-group-label">{g.label}</span>
                      <span className="classify-group-count">{g.cells.length}개</span>
                    </li>
                  ))}
                </ul>
                {classification.unclassified.length > 0 && (
                  <p className="muted small">
                    분류 안 된 {classification.unclassified.length}개는 원본 프로젝트에 그대로 남아요.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'running' && (
          <div className="dialog-body">
            <p>{progress.label || '이동 중…'}</p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="muted small">
              {progress.current} / {progress.total}
            </p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="dialog-body">
            <p className="success">
              ✓ 완료. 새 프로젝트 {result.projectsCreated}개, 셀 {result.cellsMoved}개 이동.
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="dialog-body">
            <p className="error">에러: {error}</p>
          </div>
        )}

        <div className="dialog-footer">
          {phase === 'ready' && classification?.groups.length > 0 && (
            <>
              <button onClick={onClose}>취소</button>
              <button className="primary" onClick={handleExecute}>
                실행
              </button>
            </>
          )}
          {phase === 'ready' && classification?.groups.length === 0 && (
            <button onClick={onClose}>닫기</button>
          )}
          {phase === 'analyzing' && <button disabled>분석 중…</button>}
          {phase === 'running' && <button disabled>이동 중…</button>}
          {(phase === 'done' || phase === 'error') && <button onClick={onClose}>닫기</button>}
        </div>
      </div>
    </div>
  );
}
