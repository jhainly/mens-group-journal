import Link from "next/link";

const adminTools = [
  {
    description: "Create groups, view existing groups, and open a group to review members and assigned weeks.",
    href: "/admin/groups",
    label: "Open group management",
    title: "Group management"
  },
  {
    description: "Import weeks, publish them to one or more groups, remove active weeks, and review program changes.",
    href: "/admin/programs",
    label: "Open program management",
    title: "Program management"
  },
  {
    description: "View current users and choose who has admin access.",
    href: "/admin/users",
    label: "Open user management",
    title: "User management"
  }
];

export function AdminHome() {
  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Admin tools</p>
          <h1>Administration</h1>
          <p>Choose the area you need to manage.</p>
        </div>
      </section>

      <section className="admin-tool-grid">
        {adminTools.map((tool) => (
          <article className="card stack" key={tool.href}>
            <div>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
            </div>
            <Link className="button" href={tool.href}>
              {tool.label}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
