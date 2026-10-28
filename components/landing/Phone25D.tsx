"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, type ReactNode } from "react";

/** Stacked slabs behind the screen; the tilt makes them read as the phone's thickness. */
const EDGE_LAYERS = [
  { depth: 5, color: "#2a2a2a" },
  { depth: 10, color: "#1f1f1f" },
  { depth: 15, color: "#171717" },
  { depth: 20, color: "#101010" },
  { depth: 26, color: "#0a0a0a" },
];

/**
 * 2.5D presentation for a flat device mock: perspective tilt, visible edge thickness
 * and a cast shadow, with a small cursor-follow tilt. The front face stays interactive.
 */
export default function Phone25D({ children, maxWidth = 360 }: { children: ReactNode; maxWidth?: number | string }) {
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 80, damping: 18 });
  const springY = useSpring(pointerY, { stiffness: 80, damping: 18 });
  const rotateY = useTransform(springX, (v) => -16 + v * 6);
  const rotateX = useTransform(springY, (v) => 6 - v * 5);

  useEffect(() => {
    if (reduce) return;
    const move = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1);
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, pointerX, pointerY]);

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth, perspective: 1600 }}>
      <motion.div
        className="relative"
        style={{ rotateY, rotateX, rotateZ: 1.5, transformStyle: "preserve-3d" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-6 bottom-[-22px] top-12 rounded-[48px] bg-black/55 blur-2xl"
          style={{ transform: "translateZ(-90px) translate(34px, 38px)" }}
        />
        {EDGE_LAYERS.map((layer) => (
          <div
            key={layer.depth}
            aria-hidden="true"
            className="absolute inset-0 rounded-[48px] ring-1 ring-white/10"
            style={{ background: layer.color, transform: `translateZ(-${layer.depth}px)` }}
          />
        ))}
        {children}
      </motion.div>
    </div>
  );
}
