/* ═══════════════════════════════════════════════════════════════
   useTilt.js — 3D 틸트 + 커서 팔로우 glow
   (HackHack useTilt.ts 를 JS로 포팅, React 18+)

   - hover 없는 터치 기기, prefers-reduced-motion 자동 OFF
   - mouse move 중 re-render 0회 (ref.style 직접 조작 + rAF)
   - glow 오버레이는 CSS var(--tilt-mx/my/glow-opacity)로 드라이브
   ═══════════════════════════════════════════════════════════════ */

import { useRef, useCallback, useEffect } from "react";

const PERSPECTIVE = 900;
const ENTER_TRANSITION = "transform 0.1s ease-out, border-color 0.2s";
const LEAVE_TRANSITION = "transform 0.35s ease-out, border-color 0.2s";

function shouldDisable() {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(hover: none)").matches) return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return false;
}

export function useTilt(options = {}) {
  const { intensity = 6, lift = -2, disabled = false } = options;
  const ref = useRef(null);
  const hoveringRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const onMouseEnter = useCallback(() => {
    if (disabled || shouldDisable()) return;
    const el = ref.current;
    if (!el) return;
    hoveringRef.current = true;
    el.style.transition = ENTER_TRANSITION;
    el.style.setProperty("--tilt-glow-opacity", "1");
  }, [disabled]);

  const onMouseMove = useCallback((e) => {
    if (!hoveringRef.current) return;
    const el = ref.current;
    if (!el) return;
    const clientX = e.clientX, clientY = e.clientY;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const current = ref.current;
      if (!current || !hoveringRef.current) return;
      const rect = current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      const rotateY = (nx - 0.5) * intensity * 2;
      const rotateX = (0.5 - ny) * intensity * 2;
      current.style.transform =
        `perspective(${PERSPECTIVE}px) ` +
        `rotateX(${rotateX.toFixed(2)}deg) ` +
        `rotateY(${rotateY.toFixed(2)}deg) ` +
        `translateY(${lift}px)`;
      current.style.setProperty("--tilt-mx", `${(nx * 100).toFixed(1)}%`);
      current.style.setProperty("--tilt-my", `${(ny * 100).toFixed(1)}%`);
    });
  }, [intensity, lift]);

  const onMouseLeave = useCallback(() => {
    hoveringRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    const el = ref.current;
    if (!el) return;
    el.style.transition = LEAVE_TRANSITION;
    el.style.transform = "";
    el.style.setProperty("--tilt-glow-opacity", "0");
    el.style.setProperty("--tilt-mx", "50%");
    el.style.setProperty("--tilt-my", "50%");
  }, []);

  return { ref, onMouseEnter, onMouseMove, onMouseLeave };
}

/**
 * glow 오버레이 스타일. 틸트 대상 요소의 첫 자식으로 배치.
 *   <div ref={tilt.ref} {...tilt} style={{position:'relative', ...}}>
 *     <div aria-hidden style={tiltGlowStyle()} />
 *     {content}
 *   </div>
 */
export function tiltGlowStyle(
  glowColor = "color-mix(in srgb, var(--brand-primary, #00522D) 22%, transparent)",
  size = 600
) {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    opacity: "var(--tilt-glow-opacity, 0)",
    transition: "opacity 0.3s ease",
    background:
      `radial-gradient(${size}px circle at ` +
      `var(--tilt-mx, 50%) var(--tilt-my, 50%), ` +
      `${glowColor}, transparent 45%)`,
  };
}
