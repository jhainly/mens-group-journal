import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthState } from "@/lib/amplifyServer";

export default async function HomePage() {
  const { authenticated } = await getServerAuthState();

  if (authenticated) {
    redirect("/dashboard");
  }

  return (
    <section className="panel stack">
      <p className="eyebrow">Private discipleship journal</p>
      <h1>Lifepoint Men</h1>
      <p>
        A focused place for Lifepoint Church men&apos;s groups to walk through guided weekly programs, keep personal
        reflections private, track steady participation, and stay connected with their group.
      </p>
      <div className="row">
        <Link className="button" href="/api/v1/users/planning-center/login">Sign in with Planning Center</Link>
        <Link className="button secondary" href="/auth">Legacy sign in</Link>
      </div>
    </section>
  );
}
