import { motion } from "framer-motion";

export function ResonanceLoader() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: [0, 0.4, 0],
            scale: [0.5, 2.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 1,
            ease: "easeOut",
          }}
          className="absolute h-24 w-24 rounded-full border border-accent/40"
        />
      ))}

      {/* Inner core */}
      <motion.div
        animate={{
          scale: [0.95, 1.05, 0.95],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-frequency p-4 resonance-glow"
      >
        <div className="flex items-end gap-1">
          {[0.4, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
            <motion.div
              key={i}
              animate={{
                height: [h * 20, (1.2 - h) * 20, h * 20],
              }}
              transition={{
                duration: 1 + i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-1 rounded-full bg-primary-foreground"
              style={{ height: h * 20 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
