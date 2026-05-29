import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getServerAuthState } from "@/lib/amplifyServer";

export async function AppNav() {
  const { authenticated, groups } = await getServerAuthState();
  const isAdmin = groups.some((group) => group === "ADMINS" || group === "LEADERS");

  if (!authenticated) {
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
      <Link href="/account">Account</Link>
      <LogoutButton />
    </nav>
  );
}
