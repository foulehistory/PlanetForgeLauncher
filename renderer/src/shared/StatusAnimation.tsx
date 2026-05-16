import { motion } from "framer-motion";
import { Check, Loader, X } from "lucide-react";

export type AnimationStatus = "idle" | "loading" | "success" | "error";

interface Props {
  status: Exclude<AnimationStatus, "idle">;
  loadingText: string;
  loadingSubtext: string;
  successText: string;
  successSubtext: string;
  errorText?: string;
  errorSubtext?: string;
}

export default function StatusAnimation({
  status,
  loadingText, loadingSubtext,
  successText, successSubtext,
  errorText = "Something went wrong",
  errorSubtext = "Please try again",
}: Props) {

  const config = {
    loading: { bg: "var(--accent-dim)",        border: "var(--accent)",        icon: <Loader size={24} style={{ color: "var(--accent)" }} /> },
    success: { bg: "rgba(62,207,142,0.12)",     border: "var(--color-success)", icon: <Check  size={24} style={{ color: "var(--color-success)" }} /> },
    error:   { bg: "rgba(255, 80, 80, 0.12)",   border: "var(--color-danger)",  icon: <X      size={24} style={{ color: "var(--color-danger)" }} /> },
  }[status];

  const text    = status === "success" ? successText    : status === "error" ? errorText    : loadingText;
  const subtext = status === "success" ? successSubtext : status === "error" ? errorSubtext : loadingSubtext;

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "16px 0" }}
    >
      <motion.div
        animate={
          status === "loading" ? { rotate: 360 } :
          status === "error"   ? { x: [0, -8, 8, -6, 6, 0] } :
                                 { scale: [0.8, 1.15, 1] }
        }
        transition={
          status === "loading" ? { repeat: Infinity, duration: 1, ease: "linear" } :
          status === "error"   ? { duration: 0.4 } :
                                 { duration: 0.4 }
        }
        style={{
          width: 56, height: 56, borderRadius: "50%",
          background: config.bg,
          border: `2px solid ${config.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        {config.icon}
      </motion.div>

      <motion.div
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: 14, fontWeight: 500, textAlign: "center" }}
      >
        {text}
      </motion.div>
      <motion.div
        key={subtext}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}
      >
        {subtext}
      </motion.div>
    </motion.div>
  );
}