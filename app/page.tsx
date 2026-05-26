import Link from "next/link";

export default function HomePage() {
  return (
    <section className="panel stack">
      <p className="eyebrow">Private discipleship journal</p>
      <h1>Lifepoint Men&apos;s Group Journal</h1>
      <p>
        A focused place for Lifepoint Church men&apos;s groups to walk through guided weekly programs, keep personal
        reflections private, track steady participation, and stay connected with their group.
      </p>
      <div className="row">
        <Link className="button" href="/auth">Sign in</Link>
        <Link className="button secondary" href="/create-account">Create account</Link>
      </div>
    </section>
  );
}
