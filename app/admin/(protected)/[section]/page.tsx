import { notFound } from "next/navigation";
import AdminSettings from "@/components/admin-settings";
import { isDemo } from "@/lib/config";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["knowledge", "settings", "pricing", "budget"].includes(section))
    notFound();
  return <AdminSettings key={section} section={section} demo={isDemo()} />;
}
