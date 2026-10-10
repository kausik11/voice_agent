"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
export default function Login({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = e ? new FormData(e.currentTarget) : null;
      const res = await fetch(demo ? "/api/demo" : "/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          demo
            ? {}
            : { email: form?.get("email"), password: form?.get("password") },
        ),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Unable to sign in.");
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <header>
        <Brand />
        <Link href="/">
          <ArrowLeft size={15} />
          Back to assistant
        </Link>
      </header>
      <main className="login-card">
        <span className="login-symbol">
          <LockKeyhole size={27} />
        </span>
        <span className="eyebrow">ADMINISTRATOR WORKSPACE</span>
        <h1>A little more insight.</h1>
        <p>
          Manage your assistant and see the conversations
          <br />
          that make a difference.
        </p>
        {demo ? (
          <div className="demo-login">
            <div className="notice">
              <strong>Explore the demo workspace</strong>
              <p>
                View sample conversations and dashboard data. No credentials
                required. Live data and settings are protected.
              </p>
            </div>
            <Button onClick={() => submit()} disabled={busy}>
              {busy ? "Opening…" : "Explore demo dashboard"}
              <ArrowRight size={17} />
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                name="email"
                placeholder="you@your-organization.org"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                minLength={12}
              />
            </label>
            <Button disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowRight size={17} />
            </Button>
          </form>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <div className="login-footnote">
          <ShieldCheck size={15} />
          Authorized administrators only
        </div>
      </main>
      <footer>
        Save Medha Foundation · Made for meaningful conversations.
      </footer>
    </div>
  );
}
