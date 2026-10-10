import { Suspense } from "react";
import { connection } from "next/server";
import Login from "@/components/login";
import { isDemo } from "@/lib/config";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="loading-state" role="status">
          Loading sign in…
        </div>
      }
    >
      <ConfiguredLogin />
    </Suspense>
  );
}

async function ConfiguredLogin() {
  await connection();
  return <Login demo={isDemo()} />;
}
