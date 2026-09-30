"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";

/** Compact WhatsApp-style set — no extra dependency. */
export const COMPOSE_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "😉",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😋",
  "😜",
  "🤪",
  "😝",
  "🤑",
  "🤗",
  "🤭",
  "🤫",
  "🤔",
  "🤐",
  "🤨",
  "😐",
  "😑",
  "😶",
  "🙄",
  "😏",
  "😣",
  "😥",
  "😮",
  "😯",
  "😪",
  "😫",
  "🥱",
  "😴",
  "😌",
  "😛",
  "😓",
  "😕",
  "🙃",
  "😷",
  "🤒",
  "🤕",
  "🤢",
  "🤮",
  "🥵",
  "🥶",
  "🥴",
  "😵",
  "🤯",
  "🤠",
  "🥳",
  "😎",
  "🤓",
  "🧐",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🤝",
  "🙏",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "👌",
  "🤌",
  "👈",
  "👉",
  "👆",
  "👇",
  "☝️",
  "👋",
  "🤙",
  "💪",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "💔",
  "❣️",
  "💕",
  "💞",
  "💓",
  "💗",
  "💖",
  "💘",
  "💝",
  "🔥",
  "✅",
  "❌",
  "⭐",
  "🌟",
  "✨",
  "💫",
  "🎉",
  "🎊",
  "🏆",
  "🏍️",
  "🛵",
  "🏔️",
  "🌄",
  "🌅",
  "🗺️",
  "🧭",
  "✈️",
  "🎒",
  "📷",
  "📸",
  "🎬",
  "🎵",
  "🍻",
  "☕",
  "🍕",
  "🌮",
  "☀️",
  "⛅",
  "🌧️",
  "❄️",
  "🌙",
  "💯",
  "📌",
  "📍",
  "💬",
  "💭",
] as const;

export function EmojiPicker({
  open,
  onClose,
  onPick,
  align = "left",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  align?: "left" | "right";
}) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t("pages.inbox.emojiPicker")}
      className={`absolute bottom-[calc(100%+0.4rem)] z-30 w-[min(100vw-2rem,18.5rem)] overflow-hidden rounded-2xl border border-line/80 bg-panel shadow-[0_20px_56px_rgba(0,0,0,0.48)] ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      <div className="relative border-b border-line/80 bg-linear-to-b from-[#2c2a27] to-panel px-3 py-2.5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/30 to-transparent" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
          {t("pages.inbox.emojiPicker")}
        </p>
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {COMPOSE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[1.25rem] leading-none transition-colors hover:bg-ash hover:scale-110"
            onClick={() => {
              onPick(emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
