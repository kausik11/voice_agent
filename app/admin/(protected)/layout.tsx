import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAccess } from "@/lib/admin-access";
import AdminShell from "@/components/admin-shell";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  let mode: string;
  try {
    mode = await adminAccess(await headers());
  } catch {
    redirect("/admin/login");
  }
  return <AdminShell demo={mode === "demo"}>{children}</AdminShell>;
}
