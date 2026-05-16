import { motion } from "framer-motion";

// ── Fade + scale (recommandé pour un launcher)
const variants = {
  initial:  { opacity: 0, scale: 1.04 },
  animate:  { opacity: 1, scale: 1 },
  exit:     { opacity: 0, scale: 0.94 },
};

// ── Slide up
// initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 }

// ── Slide right
// initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -60 }

export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.22, ease: "easeInOut" }}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}