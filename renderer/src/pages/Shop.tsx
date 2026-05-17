import { ShoppingBag } from "lucide-react";
import { useI18n } from "../shared/i18n";

export default function Shop() {
  const { t } = useI18n();

  return (
    <div className="page">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <ShoppingBag size={18} style={{ color: "var(--accent)" }} />
          <h2>{t.shopTitle}</h2>
        </div>
        <p>{t.shopDescription}</p>
      </div>
    </div>
  );
}
