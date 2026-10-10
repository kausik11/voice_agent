import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>This page isn’t here.</h1>
      <p>Let’s get you back to a conversation.</p>
      <Link className="button button-primary" href="/">
        Back to Medha
      </Link>
    </main>
  );
}
