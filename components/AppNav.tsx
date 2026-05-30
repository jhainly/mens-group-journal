import { ResponsiveNav, type NavItem } from "@/components/ResponsiveNav";
import { getServerAuthState } from "@/lib/amplifyServer";

export async function AppNav() {
  const { authenticated, groups } = await getServerAuthState();
  const isAdmin = groups.some((group) => group === "ADMINS" || group === "LEADERS");

  if (!authenticated) {
    return <ResponsiveNav authenticated={false} items={unauthenticatedItems} />;
  }

  const items = isAdmin ? authenticatedAdminItems : authenticatedMemberItems;

  return <ResponsiveNav authenticated items={items} />;
}

const unauthenticatedItems: NavItem[] = [
  { href: "/auth", label: "Login" },
  { href: "/join", label: "Join" }
];

const authenticatedMemberItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/account", label: "Account" }
];

const authenticatedAdminItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin/groups", label: "Admin" },
  { href: "/account", label: "Account" }
];
