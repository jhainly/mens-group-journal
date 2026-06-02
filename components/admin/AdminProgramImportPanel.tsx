import Link from "next/link";
import { YamlImportPreview } from "@/components/YamlImportPreview";

export function AdminProgramImportPanel() {
  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row">
          <h1>Import program week</h1>
          <Link className="button secondary" href="/admin/programs">
            Back
          </Link>
        </div>
      </section>

      <YamlImportPreview />
    </div>
  );
}
