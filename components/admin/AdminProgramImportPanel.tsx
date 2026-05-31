import Link from "next/link";
import { YamlImportPreview } from "@/components/YamlImportPreview";

export function AdminProgramImportPanel() {
  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Program management</p>
          <h1>Import program week</h1>
          <p>Validate YAML, preview the content, and publish weeks to one or more groups.</p>
        </div>
        <Link className="button secondary" href="/admin/programs">
          Back to program management
        </Link>
      </section>

      <YamlImportPreview />
    </div>
  );
}
