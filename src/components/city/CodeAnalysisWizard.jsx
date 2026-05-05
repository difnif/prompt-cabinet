import React, { useState, useRef } from 'react';
import { Upload, Loader, ChevronRight, Check, X, AlertTriangle, FileText } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { extractZip, stepScan, stepAnalyze, stepVerify, stepNotes, analysisToProjectData, mergeAnalysisIntoProject } from '../../utils/codeAnalyzer.js';

const STEPS = [
  { id: 'upload', label_ko: '📦 파일 업로드', label_en: '📦 Upload' },
  { id: 'scan', label_ko: '🔍 파일 스캔', label_en: '🔍 Scan' },
  { id: 'analyze', label_ko: '🏗️ 구조 분석', label_en: '🏗️ Analyze' },
  { id: 'verify', label_ko: '🔗 연결 검증', label_en: '🔗 Verify' },
  { id: 'notes', label_ko: '📝 메모 정리', label_en: '📝 Notes' },
  { id: 'done', label_ko: '✅ 완료', label_en: '✅ Done' },
];

export default function CodeAnalysisWizard({ project, onApplyResult, onClose }) {
  const { theme, themeId } = useTheme();
  const monoCls = theme.fontMono ? 'font-mono-ui' : '';
  const lang = themeId === 'sand' ? 'ko' : 'en';

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data accumulated through steps
  const [zipData, setZipData] = useState(null); // { files, fileList, packageJson }
  const [scanResult, setScanResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [verifyFeedback, setVerifyFeedback] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [devNotes, setDevNotes] = useState(null);
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'

  const fileInputRef = useRef(null);
  const isExisting = project && project.columns?.some(c => (project.structure?.[c.key] || []).length > 0);

  // ====== STEP 0: Upload ======
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setLoading(true);
    setError(null);
    try {
      const data = await extractZip(file);
      setZipData(data);
      setCurrentStep(1); // move to scan
    } catch (err) {
      setError(`${lang === 'ko' ? '압축 해제 실패' : 'Extract failed'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ====== STEP 1: Scan ======
  const handleScan = async () => {
    if (!zipData) return;
    setLoading(true);
    setError(null);
    try {
      const result = await stepScan(zipData.fileList, zipData.packageJson);
      setScanResult(result);
      setCurrentStep(2); // move to analyze
    } catch (err) {
      setError(`${lang === 'ko' ? '스캔 실패' : 'Scan failed'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ====== STEP 2: Analyze ======
  const handleAnalyze = async () => {
    if (!scanResult || !zipData) return;
    setLoading(true);
    setError(null);
    try {
      const result = await stepAnalyze(scanResult, zipData.files);
      setAnalysisResult(result);
      setCurrentStep(3); // move to verify
    } catch (err) {
      setError(`${lang === 'ko' ? '분석 실패' : 'Analysis failed'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ====== STEP 3: Verify ======
  const handleVerify = async () => {
    if (!verifyFeedback.trim()) {
      // No feedback, skip to notes
      setCurrentStep(4);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const modifications = await stepVerify(analysisResult, verifyFeedback);
      // Apply modifications to analysisResult
      if (modifications.addItems) {
        analysisResult.items = [...(analysisResult.items || []), ...modifications.addItems];
      }
      if (modifications.addRoads) {
        analysisResult.roads = [...(analysisResult.roads || []), ...modifications.addRoads];
      }
      if (modifications.removeItems) {
        const removeSet = new Set(modifications.removeItems);
        analysisResult.items = (analysisResult.items || []).filter(i => !removeSet.has(i.name));
      }
      setAnalysisResult({ ...analysisResult });
      setVerifyFeedback('');
      setCurrentStep(4); // move to notes
    } catch (err) {
      setError(`${lang === 'ko' ? '검증 실패' : 'Verify failed'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ====== STEP 4: Notes ======
  const handleNotes = async () => {
    if (!rawNotes.trim()) {
      setCurrentStep(5); // skip to done
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summary = JSON.stringify({
        columns: analysisResult?.columns?.length || 0,
        items: analysisResult?.items?.length || 0,
        roads: analysisResult?.roads?.length || 0,
        pattern: analysisResult?.detectedPattern || 'unknown'
      });
      const result = await stepNotes(summary, rawNotes);
      setDevNotes(result);
      setCurrentStep(5); // done
    } catch (err) {
      setError(`${lang === 'ko' ? '메모 정리 실패' : 'Notes failed'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ====== STEP 5: Apply ======
  const handleApply = () => {
    if (!analysisResult) return;

    let projectData;
    if (isExisting) {
      projectData = mergeAnalysisIntoProject(project, analysisResult);
    } else {
      projectData = analysisToProjectData(analysisResult);
    }

    // Attach devNotes
    if (devNotes?.devNotes) {
      projectData.devNotes = devNotes.devNotes;
    }
    if (analysisResult?.detectedPattern) {
      projectData.codeAnalysis = {
        lastAnalyzedAt: Date.now(),
        framework: scanResult?.framework || '',
        detectedPattern: analysisResult.detectedPattern,
        summary: analysisResult.summary || ''
      };
    }

    onApplyResult(projectData);
    onClose();
  };

  // ====== RENDER ======
  const stepInfo = STEPS[currentStep];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3" onClick={onClose}>
      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden`}
        onClick={e => e.stopPropagation()}>

        {/* Header with step progress */}
        <div className={`px-4 py-3 border-b ${theme.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-bold ${theme.text} ${monoCls} text-sm`}>
              {lang === 'ko' ? '코드 분석 위저드' : 'Code Analysis Wizard'}
            </span>
            <button onClick={onClose} className={`p-1 rounded ${theme.textMuted}`}><X size={16} /></button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`h-1.5 flex-1 rounded-full ${i < currentStep ? 'bg-emerald-500' : i === currentStep ? 'bg-amber-500' : `${theme.bgAlt}`}`} />
              </div>
            ))}
          </div>
          <div className={`text-[10px] ${theme.textMuted} ${monoCls} mt-1`}>
            {lang === 'ko' ? stepInfo.label_ko : stepInfo.label_en} ({currentStep + 1}/{STEPS.length})
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* STEP 0: Upload */}
          {currentStep === 0 && (
            <div className="text-center space-y-4">
              <div className={`text-5xl`}>📦</div>
              <div className={`${theme.text} ${monoCls} text-sm font-bold`}>
                {lang === 'ko' ? '코드 압축 파일을 업로드하세요' : 'Upload your code ZIP file'}
              </div>
              <div className={`text-[11px] ${theme.textMuted} ${monoCls}`}>
                {lang === 'ko' ? '.zip 파일 지원 · node_modules 등 자동 제외' : '.zip supported · node_modules auto-excluded'}
              </div>
              {isExisting && (
                <div className={`text-[10px] px-3 py-1.5 rounded-lg ${theme.bgAlt} ${theme.textMuted} ${monoCls}`}>
                  {lang === 'ko'
                    ? '⚠️ 기존 프로젝트에 분석 결과를 병합합니다'
                    : '⚠️ Results will be merged into existing project'}
                </div>
              )}
              <button onClick={() => fileInputRef.current?.click()} disabled={loading}
                className={`px-6 py-3 rounded-lg font-bold text-sm ${monoCls} ${theme.buttonPrimary} disabled:opacity-50`}>
                {loading ? <Loader size={16} className="animate-spin mx-auto" /> : (
                  <span className="flex items-center gap-2"><Upload size={16} /> {lang === 'ko' ? 'ZIP 선택' : 'Choose ZIP'}</span>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleFileUpload} />
            </div>
          )}

          {/* STEP 1: Scan */}
          {currentStep === 1 && zipData && (
            <div className="space-y-3">
              <div className={`font-bold ${theme.text} ${monoCls}`}>
                {lang === 'ko' ? `${zipData.fileList.length}개 파일 발견` : `${zipData.fileList.length} files found`}
              </div>
              <div className={`${theme.bgAlt} rounded-lg p-3 max-h-[200px] overflow-y-auto text-[10px] ${monoCls} ${theme.textMuted}`}>
                {zipData.fileList.filter(f => f.isCode).slice(0, 50).map((f, i) => (
                  <div key={i}>📄 {f.path}</div>
                ))}
                {zipData.fileList.filter(f => f.isCode).length > 50 && (
                  <div className="mt-1 font-bold">...{lang === 'ko' ? `외 ${zipData.fileList.filter(f => f.isCode).length - 50}개` : `and ${zipData.fileList.filter(f => f.isCode).length - 50} more`}</div>
                )}
              </div>
              {zipData.packageJson && (
                <div className={`text-[10px] ${theme.textMuted} ${monoCls}`}>✅ package.json {lang === 'ko' ? '발견' : 'found'}</div>
              )}
              <div className="flex gap-2">
                <button onClick={handleScan} disabled={loading}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs ${monoCls} ${theme.buttonPrimary} disabled:opacity-50 flex items-center justify-center gap-1`}>
                  {loading ? <Loader size={14} className="animate-spin" /> : <><ChevronRight size={14} /> {lang === 'ko' ? '자동 선별 분석' : 'Auto-select & analyze'}</>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Analyze */}
          {currentStep === 2 && scanResult && (
            <div className="space-y-3">
              <div className={`font-bold ${theme.text} ${monoCls}`}>
                🔍 {lang === 'ko' ? '스캔 결과' : 'Scan Result'}
              </div>
              <div className={`${theme.bgAlt} rounded-lg p-3 text-[11px] ${monoCls} ${theme.text} space-y-1`}>
                <div><strong>{lang === 'ko' ? '프레임워크' : 'Framework'}:</strong> {scanResult.framework || '?'}</div>
                <div><strong>{lang === 'ko' ? '감지된 패턴' : 'Pattern'}:</strong> {scanResult.detectedPattern || '?'}</div>
                <div><strong>{lang === 'ko' ? '요약' : 'Summary'}:</strong> {scanResult.summary || ''}</div>
                <div><strong>{lang === 'ko' ? '핵심 파일' : 'Key files'}:</strong> {scanResult.keyFiles?.length || 0}{lang === 'ko' ? '개' : ''}</div>
              </div>
              <button onClick={handleAnalyze} disabled={loading}
                className={`w-full px-4 py-2 rounded-lg font-bold text-xs ${monoCls} ${theme.buttonPrimary} disabled:opacity-50 flex items-center justify-center gap-1`}>
                {loading ? <><Loader size={14} className="animate-spin" /> {lang === 'ko' ? '구조 분석 중...' : 'Analyzing...'}</> : <><ChevronRight size={14} /> {lang === 'ko' ? '구조 분석 시작' : 'Start analysis'}</>}
              </button>
            </div>
          )}

          {/* STEP 3: Verify */}
          {currentStep === 3 && analysisResult && (
            <div className="space-y-3">
              <div className={`font-bold ${theme.text} ${monoCls}`}>
                🏗️ {lang === 'ko' ? '분석 완료' : 'Analysis Complete'}
              </div>
              <div className={`${theme.bgAlt} rounded-lg p-3 text-[10px] ${monoCls} ${theme.text} space-y-1`}>
                <div>{lang === 'ko' ? '구역' : 'Districts'}: {analysisResult.columns?.length || 0}</div>
                <div>{lang === 'ko' ? '항목' : 'Items'}: {analysisResult.items?.length || 0}</div>
                <div>{lang === 'ko' ? '연결' : 'Roads'}: {analysisResult.roads?.length || 0}</div>
                {analysisResult.detectedPattern && (
                  <div>🏗️ {lang === 'ko' ? '패턴' : 'Pattern'}: {analysisResult.detectedPattern}</div>
                )}
              </div>
              {/* Preview items */}
              <div className={`${theme.bgAlt} rounded-lg p-2 max-h-[150px] overflow-y-auto text-[9px] ${monoCls} ${theme.textMuted}`}>
                {(analysisResult.items || []).slice(0, 20).map((item, i) => (
                  <div key={i}>{item.parentName ? '  └─' : '●'} {item.name} [{item.buildingType}]</div>
                ))}
              </div>
              <div className={`text-[11px] ${theme.text} ${monoCls} font-bold`}>
                {lang === 'ko' ? '추가할 연결이나 수정사항이 있나요?' : 'Any connections to add or changes?'}
              </div>
              <textarea value={verifyFeedback} onChange={e => setVerifyFeedback(e.target.value)}
                placeholder={lang === 'ko' ? '예: "결제 모듈이 Stripe와 연결돼야 해", "알림 서비스 빠졌어"' : 'e.g. "Payment connects to Stripe", "Missing notification service"'}
                className={`w-full h-20 px-3 py-2 text-xs border rounded-lg resize-none focus:outline-none ${monoCls} ${theme.input}`} />
              <div className="flex gap-2">
                <button onClick={handleVerify} disabled={loading}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs ${monoCls} ${verifyFeedback.trim() ? theme.buttonPrimary : theme.button} border disabled:opacity-50 flex items-center justify-center gap-1`}>
                  {loading ? <Loader size={14} className="animate-spin" /> : verifyFeedback.trim()
                    ? <><ChevronRight size={14} /> {lang === 'ko' ? '반영 후 다음' : 'Apply & next'}</>
                    : <><ChevronRight size={14} /> {lang === 'ko' ? '이대로 진행' : 'Skip to next'}</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Notes */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <div className={`font-bold ${theme.text} ${monoCls}`}>
                📝 {lang === 'ko' ? '개발 요청사항 및 메모' : 'Development Notes'}
              </div>
              <div className={`text-[11px] ${theme.textMuted} ${monoCls}`}>
                {lang === 'ko'
                  ? '강조사항, 요구사항, 기술 제약 등을 자유롭게 적어주세요.\n명세서 생성 시 자동으로 정리돼서 포함됩니다.'
                  : 'Add any requirements, constraints, or notes.\nThey\'ll be organized and included in the spec.'}
              </div>
              <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)}
                placeholder={lang === 'ko'
                  ? '예:\n- 결제는 Stripe 연동\n- FCM 푸시 알림 필수\n- 다크모드 지원\n- 초기 로드 3초 이내\n- TypeScript 사용'
                  : 'e.g.:\n- Stripe for payments\n- FCM push required\n- Dark mode support\n- Initial load < 3s\n- TypeScript'}
                className={`w-full h-32 px-3 py-2 text-xs border rounded-lg resize-none focus:outline-none ${monoCls} ${theme.input}`} />
              <div className="flex gap-2">
                <button onClick={handleNotes} disabled={loading}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs ${monoCls} ${rawNotes.trim() ? theme.buttonPrimary : theme.button} border disabled:opacity-50 flex items-center justify-center gap-1`}>
                  {loading ? <Loader size={14} className="animate-spin" /> : rawNotes.trim()
                    ? <><ChevronRight size={14} /> {lang === 'ko' ? '정리 후 완료' : 'Organize & finish'}</>
                    : <><ChevronRight size={14} /> {lang === 'ko' ? '건너뛰기' : 'Skip'}</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Done */}
          {currentStep === 5 && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <div className={`${theme.text} ${monoCls} font-bold`}>
                {lang === 'ko' ? '분석 완료!' : 'Analysis Complete!'}
              </div>
              <div className={`${theme.bgAlt} rounded-lg p-3 text-[11px] ${monoCls} ${theme.text} text-left space-y-1`}>
                <div>📊 {lang === 'ko' ? '구역' : 'Districts'}: {analysisResult?.columns?.length || 0}</div>
                <div>🏢 {lang === 'ko' ? '항목' : 'Items'}: {analysisResult?.items?.length || 0}</div>
                <div>🛤️ {lang === 'ko' ? '연결' : 'Roads'}: {analysisResult?.roads?.length || 0}</div>
                {analysisResult?.detectedPattern && <div>🏗️ Pattern: {analysisResult.detectedPattern}</div>}
                {devNotes?.devNotes && <div>📝 {lang === 'ko' ? '메모' : 'Notes'}: {devNotes.devNotes.length}{lang === 'ko' ? '건' : ''}</div>}
              </div>
              <div className={`text-[10px] ${theme.textMuted} ${monoCls}`}>
                {isExisting
                  ? (lang === 'ko' ? '기존 프로젝트에 병합됩니다' : 'Will be merged into existing project')
                  : (lang === 'ko' ? '새 프로젝트 구조로 적용됩니다' : 'Will be applied as new structure')
                }
              </div>
              <button onClick={handleApply}
                className={`px-6 py-3 rounded-lg font-bold text-sm ${monoCls} ${theme.buttonPrimary} flex items-center justify-center gap-2 mx-auto`}>
                <Check size={16} /> {lang === 'ko' ? '프로젝트에 적용' : 'Apply to project'}
              </button>
            </div>
          )}
        </div>

        {/* Footer: back button */}
        {currentStep > 0 && currentStep < 5 && (
          <div className={`px-4 py-2 border-t ${theme.border} flex items-center`}>
            <button onClick={() => setCurrentStep(prev => prev - 1)}
              className={`text-[11px] ${theme.textMuted} ${monoCls}`}>
              ← {lang === 'ko' ? '이전 단계' : 'Previous step'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
