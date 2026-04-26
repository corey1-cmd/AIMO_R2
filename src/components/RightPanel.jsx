/* RightPanel.jsx — 우측 컬럼 mode 분기 컨테이너 (Lenu §4-1)
 *
 * mode === 'input': WORK FLOW 헤더 + TaskInputCard 들 + AddTaskButton + AnalyzeCTA
 * mode === 'focus': FocusInline (현재 진행 세션)
 *
 * 가이드 §6: box inline replace, 640ms fade transition. 페이지 이동 없음.
 *
 * Props:
 *   mode: 'input' | 'focus'
 *   activePlan: 진행 중 플랜 (focus 모드일 때 사용)
 *   onAnalyze: (validTasks) => { unrecognized?: [...] }
 *   onResumeFocus: () => void
 *   onCloseFocus: () => void
 *   onShowGuide: () => void
 */

import { useEffect, useState } from 'react';
import { uid } from '../constants';
import { WorkflowHeader } from './WorkflowHeader.jsx';
import { TaskInputCard } from './TaskInputCard.jsx';
import { AddTaskButton } from './AddTaskButton.jsx';
import { AnalyzeCTA } from './AnalyzeCTA.jsx';
import { ParserErrorCard } from './ParserErrorCard.jsx';
import { FocusInline } from './FocusInline.jsx';

const MAX_TASKS = 7;

export function RightPanel({ mode, activePlan, onAnalyze, onResumeFocus, onCloseFocus, onShowGuide }) {
  const [tasks, setTasks] = useState([{ id: uid(), title: '', estimatedMin: '', category: '' }]);
  const [error, setError] = useState(null);

  const [renderedMode, setRenderedMode] = useState(mode);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (mode === renderedMode) return;
    setOpacity(0);
    const t = setTimeout(() => {
      setRenderedMode(mode);
      setOpacity(1);
    }, 320);
    return () => clearTimeout(t);
  }, [mode, renderedMode]);

  const addTask = () => {
    if (tasks.length >= MAX_TASKS) return;
    setTasks([...tasks, { id: uid(), title: '', estimatedMin: '', category: '' }]);
  };
  const removeTask = (id) => {
    if (tasks.length <= 1) return;
    setTasks(tasks.filter(t => t.id !== id));
  };
  const updateTask = (next) => {
    setTasks(tasks.map(t => t.id === next.id ? next : t));
  };

  const validCount = tasks.filter(t => t.title.trim()).length;

  const handleAnalyze = () => {
    const valid = tasks.filter(t => t.title.trim());
    if (valid.length === 0) return;
    setError(null);
    if (onAnalyze) {
      const result = onAnalyze(valid);
      if (result?.unrecognized) setError(result.unrecognized);
    }
  };

  return (
    <section style={{
      width: '100%',
      transition: 'opacity 320ms ease',
      opacity,
    }}>
      {renderedMode === 'focus' ? (
        <FocusInline
          plan={activePlan}
          onResume={onResumeFocus}
          onClose={onCloseFocus}
        />
      ) : (
        <>
          <WorkflowHeader onShowGuide={onShowGuide} />

          {error && (
            <ParserErrorCard
              unrecognized={error}
              onClose={() => setError(null)}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {tasks.map((task, i) => (
              <TaskInputCard
                key={task.id}
                index={i}
                task={task}
                canRemove={tasks.length > 1}
                onChange={updateTask}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </div>

          <div style={{ marginBottom: 24 }}>
            <AddTaskButton
              onClick={addTask}
              disabled={tasks.length >= MAX_TASKS}
            />
          </div>

          <AnalyzeCTA
            onClick={handleAnalyze}
            disabled={validCount === 0}
            count={validCount}
          />
        </>
      )}
    </section>
  );
}
