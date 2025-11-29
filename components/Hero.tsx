'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 20; // -10 to 10 deg
      const y = (e.clientY / innerHeight - 0.5) * 20; // -10 to 10 deg
      setRotation({ x: -y, y: x });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
              <motion.div
                  key={i}
                  className="absolute bg-emerald-500/20 rounded-full blur-xl"
                  initial={{
                      x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                      y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000),
                      scale: Math.random() * 0.5 + 0.5,
                      opacity: 0
                  }}
                  animate={{
                      y: [null, Math.random() * -100],
                      opacity: [0, 0.5, 0],
                  }}
                  transition={{
                      duration: Math.random() * 10 + 10,
                      repeat: Infinity,
                      ease: "linear",
                      delay: Math.random() * 5
                  }}
                  style={{
                      width: Math.random() * 300 + 50,
                      height: Math.random() * 300 + 50,
                  }}
              />
          ))}
      </div>

      {/* 3D Gyroscope Container */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-40 md:opacity-100"
        style={{
          perspective: '1000px',
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="w-[600px] h-[600px] rounded-full border border-white/10 bg-gradient-to-tr from-emerald-500/5 to-transparent backdrop-blur-sm"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transition: 'transform 0.1s ease-out',
            boxShadow: '0 0 100px -20px rgba(16, 185, 129, 0.1)',
          }}
        >
          <div className="absolute inset-4 rounded-full border border-white/5 border-dashed animate-[spin_60s_linear_infinite]" />
          <div className="absolute inset-20 rounded-full border border-emerald-500/10 animate-[spin_40s_linear_infinite_reverse]" />
          <div className="absolute inset-[30%] rounded-full bg-emerald-500/5 blur-3xl" />
        </motion.div>
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-emerald-400 text-xs font-medium mb-6 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Market Data: Live (EOD)
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6">
            Institutional Grade <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
              Portfolio Intelligence
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Replace the clutter of traditional financial portals with a liquid trading terminal.
            Real-time x-ray allocation, complex metric comparison, and wealth projection.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onStart}
              className="group px-8 py-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] flex items-center gap-2 cursor-pointer"
            >
              Launch Terminal
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onStart}
              className="px-8 py-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors backdrop-blur-md cursor-pointer"
            >
              Simulate Wealth
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
