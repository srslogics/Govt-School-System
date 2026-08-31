"use client";

import { Send } from "lucide-react";

const LIVE_URL = "https://govt-school-system.onrender.com/";
const SHARE_TEXT = `Shikshan Setu — Nagpur District School Administration System\n${LIVE_URL}`;

export function WhatsAppShare({
  className = "",
  label = false,
}: {
  className?: string;
  label?: boolean;
}) {
  const share = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      className={`whatsapp-share ${className}`.trim()}
      onClick={share}
      aria-label="Share on WhatsApp"
      title="Share on WhatsApp"
    >
      <Send size={15} fill="currentColor" />
      {label && <span>Share</span>}
    </button>
  );
}
