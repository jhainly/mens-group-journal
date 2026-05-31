import Link from "next/link";
import { AdminRolePanel } from "@/components/admin/AdminRolePanel";

export function AdminUsersPanel() {
  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Admin tools</p>
          <h1>User management</h1>
          <p>View current users and choose who has admin access.</p>
        </div>
        <Link className="button secondary" href="/admin">
          Back to admin tools
        </Link>
      </section>

      <AdminRolePanel />
    </div>
  );
}
