"use client";

import { useId, useState } from "react";

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
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className={className}>
      <div className="flex justify-between items-center gap-3 mb-1">
        <label htmlFor={id} className="text-body text-xs">{label}</label>
        <output htmlFor={id} className="text-compass text-sm tabular-nums">{value}{unit}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        aria-valuetext={`${value}${unit}`}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          setValue(nextValue);
          onChange?.(nextValue);
        }}
        className="w-full min-h-8 accent-compass-action dark:accent-compass cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
      />
    </div>
  );
}
