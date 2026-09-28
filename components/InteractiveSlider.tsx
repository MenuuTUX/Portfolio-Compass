"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface InteractiveSliderProps {
  label: string;
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  className?: string;
  unit?: string;
}

export default function InteractiveSlider({
  label,
  min = 0,
  max = 100,
  defaultValue = 50,
  onChange,
  className = "",
  unit = "%",
}: InteractiveSliderProps) {
  const [value, setValue] = useState(defaultValue);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useMotionValue(0);

  // Calculate percentage for visuals
  const percentage = useTransform(x, [0, trackWidth || 1], ["0%", "100%"]);
  const color = useTransform(
    x,
    [0, (trackWidth || 1) / 2, trackWidth || 1],
    ["#059669", "#10b981", "#34d399"], // Emerald gradient
  );

  const glowOpacity = useTransform(x, [0, trackWidth || 1], [0.2, 0.8]);

  useEffect(() => {
    if (constraintsRef.current) {
      setTrackWidth(constraintsRef.current.offsetWidth);

      // Handle resize
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setTrackWidth(entry.contentRect.width);
        }
      });
      observer.observe(constraintsRef.current);
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    // Initialize position based on default value
    if (trackWidth > 0) {
      const initialX = ((defaultValue - min) / (max - min)) * trackWidth;
      x.set(initialX);
    }
  }, [trackWidth, defaultValue, min, max, x]);

  const handleDrag = () => {
    const currentX = x.get();
    if (trackWidth === 0) return;

    const newPercent = Math.max(
      0,
      Math.min(100, (currentX / trackWidth) * 100),
    );
    const newValue = Math.round((newPercent / 100) * (max - min) + min);

    if (newValue !== value) {
      setValue(newValue);
      onChange?.(newValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (!direction) return;

    event.preventDefault();
    const nextValue = Math.max(min, Math.min(max, value + direction * step));
    setValue(nextValue);
    onChange?.(nextValue);
    if (trackWidth > 0) {
      x.set(((nextValue - min) / (max - min)) * trackWidth);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex justify-between items-end mb-1">
        <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
          {label}
        </span>
        <motion.span
          className="text-emerald-400 text-sm font-display font-bold"
          style={{ opacity: glowOpacity }}
        >
          {value}
          {unit}
        </motion.span>
      </div>

      <div
        className="relative h-12 flex items-center w-full"
        ref={constraintsRef}
      >
        {/* Track Background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-stone-800/50 rounded-full overflow-hidden -translate-y-1/2 backdrop-blur-sm border border-stone-700/30">
          <motion.div
            className="h-full bg-emerald-900/40"
            style={{ width: percentage }}
          />
        </div>

        {/* Active Fill Track */}
        <div className="absolute top-1/2 left-0 h-1 -translate-y-1/2 pointer-events-none">
          <motion.div
            className="h-full rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            style={{ width: x, backgroundColor: color }}
          />
        </div>

        {/* Thumb */}
        <motion.div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${value}${unit}`}
          drag="x"
          dragConstraints={{ left: 0, right: trackWidth }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          style={{ x }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onKeyDown={handleKeyDown}
            className="absolute top-1/2 left-0 -translate-y-1/2 -ml-3 cursor-grab active:cursor-grabbing z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          {/* Outer Glow */}
          <motion.div
            className="absolute inset-0 bg-emerald-500 rounded-full blur-md"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Core */}
          <div className="relative w-6 h-6 bg-stone-900 rounded-full border-2 border-emerald-400 flex items-center justify-center shadow-lg">
            <div className="w-2 h-2 bg-emerald-200 rounded-full" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
