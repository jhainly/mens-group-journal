import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getAuthenticatedUser, getServerSessionGroups } from "@/lib/amplifyServer";

export async function AppNav() {
  const [user, groups] = await Promise.all([getAuthenticatedUser(), getServerSessionGroups()]);
  const isAdmin = groups.some((group) => group === "ADMINS" || group === "LEADERS");

  if (!user) {
    return (
      <nav className="nav" aria-label="Primary">
        <Link href="/auth">Login</Link>
        <Link href="/join">Join</Link>
      </nav>
    );
  }

  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/leaderboard">Leaderboard</Link>
      {isAdmin ? <Link href="/admin/groups">Admin</Link> : null}
      <LogoutButton />
    </nav>
  );
}
