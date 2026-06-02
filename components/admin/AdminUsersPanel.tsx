import { AdminNav } from "@/components/admin/AdminNav";
import { AdminRolePanel } from "@/components/admin/AdminRolePanel";

export function AdminUsersPanel() {
  return (
    <div className="stack">
      <AdminNav />
      <AdminRolePanel />
    </div>
  );
}
