import { Anchor } from "lucide-react";
import Link from "next/link";
export function Brand() {
  return (
    <Link
      href="/"
      className="brand academy-brand"
      aria-label="Mercantile Marine Academy home"
    >
      <span className="brand-icon">
        <Anchor size={24} />
      </span>
      <span>
        Mercantile Marine<span className="academy-brand-line">Academy</span>
        <small>AI VOICE ASSISTANT</small>
      </span>
    </Link>
  );
}
