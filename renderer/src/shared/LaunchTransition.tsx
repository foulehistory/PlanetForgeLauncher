import { motion } from "framer-motion";
import { Globe } from "lucide-react";

export default function LaunchTransition({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        pointerEvents: "none",
      }}
    >
      {/* Cercle solide qui s'étend pour couvrir tout l'écran */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 50 }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        onAnimationComplete={onComplete}
        style={{
          position: "absolute",
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "#3ecf8e", // vert succès solide — visible à coup sûr
        }}
      />

      {/* Logo au centre pendant l'expand */}
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.75 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{
          width: 64, height: 64,
          borderRadius: "50%",
          background: "rgba(62,207,142,0.12)",
          border: "2px solid #3ecf8e",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Globe size={28} style={{ color: "#3ecf8e" }} />
        </div>
        <span style={{ fontSize: 13, color: "#3ecf8e", fontWeight: 500 }}>
          Launching…
        </span>
      </motion.div>
    </motion.div>
  );
}