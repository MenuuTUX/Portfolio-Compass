"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { EASE } from "../motion/Reveal";

/**
 * Original painterly artwork: thick overlapping brush bands forming an arch, drawn in
 * the product palette. An SVG filter roughens the edges (turbulence displacement) and
 * adds bristle streaks and paper grain. Bands draw in one after another, then the whole
 * piece floats slowly. Purely visual, hidden from assistive tech.
 */
const BANDS = [
  { d: "M20 500 C20 260 140 70 340 70", color: "#E0B84A", width: 74, narrow: 52, opacity: 0.96 },
  { d: "M96 530 C96 300 196 120 396 120", color: "#84C58A", width: 70, narrow: 50, opacity: 1 },
  { d: "M170 550 C170 330 260 170 450 170", color: "#B6A5E6", width: 76, narrow: 54, opacity: 0.93 },
  { d: "M244 570 C244 370 320 220 504 220", color: "#E5703F", width: 68, narrow: 48, opacity: 0.98 },
  { d: "M318 590 C318 410 378 270 556 270", color: "#2F7A55", width: 72, narrow: 50, opacity: 0.95 },
  { d: "M392 610 C392 450 436 320 600 320", color: "#7A4B33", width: 64, narrow: 44, opacity: 0.92 },
];

export default function BrushArt({ className, delay = 0.2 }: { className?: string; delay?: number }) {
  const uid = useId().replace(/:/g, "");
  const brush = `pc-brush-${uid}`;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 8, ease: "easeInOut", repeat: Infinity, delay: delay + 1.8 }}
    >
      <svg viewBox="0 0 640 640" className="block w-full overflow-visible" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <filter id={brush} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            {/* rough edges */}
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.6" numOctaves="2" seed="4" result="rough" />
            <feDisplacementMap in="SourceGraphic" in2="rough" scale="18" xChannelSelector="R" yChannelSelector="G" result="shape" />
            {/* bristle streaks, clipped to the painted shape */}
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.4" numOctaves="2" seed="11" result="streakNoise" />
            <feColorMatrix in="streakNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0 0 0 -0.3" result="streakAlpha" />
            <feComposite in="streakAlpha" in2="shape" operator="in" result="streaks" />
            {/* light dry-brush highlights */}
            <feColorMatrix in="streakNoise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -0.9 0 0 0 0.16" result="lightAlpha" />
            <feComposite in="lightAlpha" in2="shape" operator="in" result="lights" />
            {/* paper grain speckle */}
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="grainNoise" />
            <feColorMatrix in="grainNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0.9 0 0 -0.38" result="grainAlpha" />
            <feComposite in="grainAlpha" in2="shape" operator="in" result="grain" />
            <feMerge>
              <feMergeNode in="shape" />
              <feMergeNode in="lights" />
              <feMergeNode in="streaks" />
              <feMergeNode in="grain" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#${brush})`}>
          {BANDS.map((band, i) => (
            <g key={band.color} style={{ mixBlendMode: "multiply" }}>
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: band.opacity }}
                transition={{ duration: 0.3, delay: delay + i * 0.14 }}
              >
                {/* wide soft body */}
                <motion.path
                  d={band.d}
                  stroke={band.color}
                  strokeWidth={band.width}
                  strokeLinecap="round"
                  strokeOpacity="0.88"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ pathLength: { duration: 1.4, delay: delay + i * 0.14, ease: EASE } }}
                />
                {/* narrower, denser core gives the stroke a varying width */}
                <motion.path
                  d={band.d}
                  stroke={band.color}
                  strokeWidth={band.narrow}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 0.97 }}
                  transition={{ pathLength: { duration: 1.5, delay: delay + 0.08 + i * 0.14, ease: EASE } }}
                />
              </motion.g>
            </g>
          ))}
        </g>
      </svg>
    </motion.div>
  );
}
