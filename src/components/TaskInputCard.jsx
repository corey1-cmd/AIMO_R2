/* TaskInputCard.jsx — 우측 input 모드 작업 입력 (Atelier Cyan v6b)
 * 라이트 글래스 + 좌측 액센트 라인(focus 시 일렉트릭 민트로 점등) + 번호 원
 * Props: index, task, canRemove, onChange, onRemove */

import { useState } from 'react';
import { T, CATEGORIES } from '../constants';

export function TaskInputCard({ index, task, canRemove, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...task, [field]: value });
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isActive = focused || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '20px 22px',
        background: isActive ? T.glass.lightHover : T.glass.light,
        backdropFilter: T.glass.blur,
        WebkitBackdropFilter: T.glass.blur,
        border: `1px solid ${isActive ? 'rgba(0, 82, 45, 0.14)' : T.glass.lightBorder}`,
        borderRadius: T.radius.xxl,
        boxShadow: isActive ? T.shadow.glassHover : T.shadow.glass,
        transition: 'border-color 220ms ease, box-shadow 220ms ease, background 220ms ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 좌측 액센트 라인 — focus 시 점등 */}
      <div aria-hidden style={{
        position: 'absolute',
        left: 0, top: 12, bottom: 12,
        width: 3,
        borderRadius: '0 2px 2px 0',
        background: focused
          ? `linear-gradient(180deg, ${T.color.primary}, ${T.color.electricMint})`
          : 'transparent',
        transition: 'background 240ms ease',
        pointerEvents: 'none',
      }} />

      <span style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: T.color.mint,
        color: T.color.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: T.font_.weight.bold,
        fontFamily: T.font_.familyMono,
        marginTop: 2,
        border: '1px solid rgba(0, 82, 45, 0.10)',
      }}>{index + 1}</span>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <input
          type="text"
          value={task.title}
          onChange={(e) => update('title', e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="예: 샤워, 이메일 확인, 논문 작성"
          style={{
            width: '100%',
            padding: 0,
            border: 'none',
            outline: 'none',
            fontSize: T.font_.size.body,
            fontWeight: T.font_.weight.medium,
            fontFamily: 'inherit',
            color: T.color.textPrimary,
            background: 'transparent',
            letterSpacing: T.font_.tracking.tight,
          }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={task.estimatedMin || ''}
            onChange={(e) => update('estimatedMin', e.target.value)}
            placeholder="예상 시간 (분)"
            inputMode="numeric"
            style={metaInputStyle()}
          />
          <select
            value={task.category || ''}
            onChange={(e) => update('category', e.target.value)}
            style={metaInputStyle({ minWidth: 130 })}
          >
            <option value="">카테고리</option>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {canRemove && (
        <button
          onClick={onRemove}
          aria-label="이 항목 제거"
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            color: T.color.textMuted,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
            transition: 'background 200ms ease, color 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.color.errorSoft;
            e.currentTarget.style.color = T.color.error;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = T.color.textMuted;
          }}
        >×</button>
      )}
    </div>
  );
}

const metaInputStyle = (extra = {}) => ({
  padding: '8px 12px',
  fontSize: 12,
  fontFamily: T.font_.familyMono,
  background: 'rgba(255, 255, 255, 0.6)',
  border: `1px solid ${T.glass.lightBorder}`,
  borderRadius: T.radius.sm,
  color: T.color.textPrimary,
  outline: 'none',
  width: 140,
  letterSpacing: '0.01em',
  transition: 'border-color 200ms ease, background 200ms ease',
  ...extra,
});
