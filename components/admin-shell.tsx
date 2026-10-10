"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  BookOpen,
  Settings2,
  Wallet,
  CircleDollarSign,
  ArrowUpRight,
  LogOut,
  AudioLines,
  PanelLeftClose,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Brand } from "./brand";
const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sessions", label: "Conversations", icon: MessagesSquare },
  { href: "/admin/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/admin/settings", label: "Agent settings", icon: Settings2 },
  { href: "/admin/pricing", label: "Model pricing", icon: CircleDollarSign },
  { href: "/admin/budget", label: "Budget & alerts", icon: Wallet },
];
export default function AdminShell({
  children,
  demo,
}: {
  children: React.ReactNode;
  demo: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch(demo ? "/api/demo" : "/api/auth/sign-out", {
      method: demo ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: demo ? undefined : "{}",
    });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <div className="admin-app">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Brand />
        <div className="workspace">
          <span className="workspace-mark">SM</span>
          <span>
            <strong>Save Medha Foundation</strong>
            <small>Administrator workspace</small>
          </span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navigation.map((n) => (
            <Link
              onClick={() => setOpen(false)}
              href={n.href}
              key={n.href}
              className={
                path === n.href ||
                (n.href === "/admin/sessions" && path.startsWith(n.href))
                  ? "active"
                  : ""
              }
            >
              <n.icon size={19} />
              {n.label}
              {path === n.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-agent">
            <span className="small-orb">
              <AudioLines size={23} />
            </span>
            <strong>Conversations that care.</strong>
            <p>See your assistant in action.</p>
            <Link href="/">
              Open voice assistant <ArrowUpRight size={15} />
            </Link>
          </div>
          <button className="logout" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
          <div className="admin-profile">
            <span>AD</span>
            <div>
              <strong>{demo ? "Demo administrator" : "Administrator"}</strong>
              <small>{demo ? "Read-only preview" : "Secure workspace"}</small>
            </div>
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <PanelLeftClose size={22} /> : <Menu size={22} />}
          </button>
          <span>
            Workspace <span className="breadcrumb-separator">/</span>{" "}
            <strong>
              {navigation.find((n) => n.href === path)?.label ??
                "Conversation details"}
            </strong>
          </span>
          <div>
            <span className={demo ? "demo-badge" : "live-badge"}>
              {demo ? "DEMO WORKSPACE" : "LIVE WORKSPACE"}
            </span>
            <Link href="/">
              Voice assistant <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        {demo && (
          <div className="admin-demo-banner">
            <span className="red-dot" />
            You’re viewing sample data. Demo records are separate from live
            conversations; changes are not saved.
          </div>
        )}
        <main className="admin-main">{children}</main>
        <footer className="admin-footer">
          Save Medha Foundation{" "}
          <span>Private administrator workspace · Medha</span>
        </footer>
      </div>
    </div>
  );
}
