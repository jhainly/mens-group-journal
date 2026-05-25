import { AdminGroupDetail } from "@/components/admin/AdminGroupDetail";

type AdminGroupDetailPageProps = {
  params: Promise<{
    groupId: string;
  }>;
};

export default async function AdminGroupDetailPage({ params }: AdminGroupDetailPageProps) {
  const { groupId } = await params;
  return <AdminGroupDetail groupId={groupId} />;
}
