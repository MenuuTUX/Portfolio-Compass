"use client";

import { LazyMotion, MotionConfig } from "framer-motion";

// The animation engine loads after first paint instead of in the first bundle.
// domMax is needed for shared-layout animations (layoutId); until it arrives, elements render in their final state.
const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
