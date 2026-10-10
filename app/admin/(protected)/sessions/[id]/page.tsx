import SessionDetail from "@/components/session-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SessionDetail id={(await params).id} />;
}
