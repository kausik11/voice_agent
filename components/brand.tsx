import { AudioLines } from "lucide-react";
import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Medha home">
      <span className="brand-icon">
        <AudioLines size={24} />
      </span>
      <span>
        medha<span className="brand-dot">.</span>
        <small>VOICE ASSISTANT</small>
      </span>
    </Link>
  );
}
