import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 14;

export function useLongPressSelect(options: {
  onToggle: () => void;
  disabled?: boolean;
}) {
  const { onToggle, disabled } = options;
  const nodeRef = useRef<HTMLElement | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const didLongPress = useRef(false);
  const usingTouch = useRef(false);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  function clearPressTimer() {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function fireLongPress() {
    didLongPress.current = true;
    pressTimer.current = null;
    window.getSelection()?.removeAllRanges();
    onToggleRef.current();
    try {
      navigator.vibrate?.(12);
    } catch {
      /* unsupported */
    }
  }

  function suppressGhostClick() {
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", block, true);
    document.addEventListener("auxclick", block, true);
    window.setTimeout(() => {
      document.removeEventListener("click", block, true);
      document.removeEventListener("auxclick", block, true);
      didLongPress.current = false;
    }, 450);
  }

  useEffect(() => {
    const el = nodeRef.current;
    if (!el || disabled) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      usingTouch.current = true;
      didLongPress.current = false;
      pressOrigin.current = { x: touch.clientX, y: touch.clientY };
      clearPressTimer();
      pressTimer.current = window.setTimeout(fireLongPress, LONG_PRESS_MS);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pressOrigin.current || pressTimer.current == null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - pressOrigin.current.x;
      const dy = touch.clientY - pressOrigin.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearPressTimer();
        pressOrigin.current = null;
      }
    };

    const onTouchEnd = () => {
      clearPressTimer();
      pressOrigin.current = null;
      if (didLongPress.current) suppressGhostClick();
      window.setTimeout(() => {
        usingTouch.current = false;
      }, 0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      clearPressTimer();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled]);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (disabled) return;
    if (event.pointerType === "touch" || usingTouch.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    didLongPress.current = false;
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    clearPressTimer();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* unsupported */
    }
    pressTimer.current = window.setTimeout(fireLongPress, LONG_PRESS_MS);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || usingTouch.current) return;
    if (!pressOrigin.current || pressTimer.current == null) return;
    const dx = event.clientX - pressOrigin.current.x;
    const dy = event.clientY - pressOrigin.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPressTimer();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || usingTouch.current) return;
    clearPressTimer();
    pressOrigin.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    }
    if (didLongPress.current) suppressGhostClick();
  }

  function consumeLongPress() {
    if (!didLongPress.current) return false;
    didLongPress.current = false;
    return true;
  }

  return {
    setNode: (node: HTMLElement | null) => {
      nodeRef.current = node;
    },
    consumeLongPress,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onContextMenu: (event: { preventDefault: () => void }) => {
        if (disabled) return;
        event.preventDefault();
        if (!didLongPress.current) onToggle();
      },
      style: {
        WebkitTouchCallout: "none" as const,
        WebkitUserSelect: "none" as const,
        userSelect: "none" as const,
        touchAction: "pan-y" as const,
      },
    },
  };
}
