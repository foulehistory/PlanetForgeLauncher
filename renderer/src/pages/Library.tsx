import { LibraryBig } from "lucide-react";
import { useI18n } from "../shared/i18n";

export default function Library() {
  const { t } = useI18n();

  return (
    <div className="page">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <LibraryBig size={18} style={{ color: "var(--accent)" }} />
          <h2>{t.libraryTitle}</h2>
        </div>
        <p>{t.libraryDescription}</p>
      </div>
    </div>
  );
}
