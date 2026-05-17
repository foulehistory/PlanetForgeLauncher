import { Wrench } from "lucide-react";
import { useI18n } from "../shared/i18n";

export default function Engine() {
  const { t } = useI18n();

  return (
    <div className="page">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Wrench size={18} style={{ color: "var(--accent)" }} />
          <h2>{t.engineTitle}</h2>
        </div>
        <p>{t.engineDescription}</p>
      </div>
    </div>
  );
}
