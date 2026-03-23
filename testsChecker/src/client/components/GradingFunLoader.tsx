"use client";

import { useEffect, useState } from "react";

type LoaderPhase = "idle" | "reading" | "ai";

const READING_LINES = [
  "Collecting every file from your project…",
  "Following folders and paths…",
  "Bundling it up for the grader…",
];

const AI_LINES = [
  "Reading your rubric and conventions…",
  "Scanning structure and logic…",
  "Comparing against each criterion…",
  "Double-checking numbers and tone…",
  "Almost there — polishing the draft…",
];

type GradingFunLoaderProps = {
  phase: LoaderPhase;
};

function LoaderInner({ phase }: { phase: "reading" | "ai" }) {
  const [lineIndex, setLineIndex] = useState(0);
  const lines = phase === "reading" ? READING_LINES : AI_LINES;
  const ms = phase === "reading" ? 1800 : 2200;

  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % lines.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [phase, lines.length, ms]);

  const title = phase === "reading" ? "Reading your upload" : "AI is grading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="alert"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border p-6 shadow-2xl"
        style={{
          borderColor: "var(--theme-border)",
          backgroundColor: "color-mix(in srgb, var(--theme-surface) 96%, transparent)",
          boxShadow: `0 25px 50px -12px color-mix(in srgb, var(--theme-primary) 18%, transparent)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--theme-primary) 35%, transparent)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full blur-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--theme-ring) 28%, transparent)" }}
        />

        <div className="relative flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, var(--theme-primary), var(--theme-primary-hover))`,
            }}
          >
            <span className="grading-loader-bounce inline-block">✨</span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--theme-primary)" }}
            >
              {phase === "reading" ? "Step 1" : "Step 2"}
            </p>
            <h2 className="mt-0.5 text-lg font-bold app-text">{title}</h2>
            <p className="mt-2 min-h-[3rem] text-sm leading-relaxed app-text-secondary transition-opacity duration-300">
              {lines[lineIndex]}
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex items-center justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="grading-loader-dot h-2 w-2 rounded-full"
              style={{
                animationDelay: `${i * 0.12}s`,
                backgroundColor: "var(--theme-primary)",
              }}
            />
          ))}
        </div>

        <p className="relative mt-4 text-center text-xs app-text-subtle">
          You can keep this tab open — we’ll show results when it’s ready.
        </p>
      </div>
    </div>
  );
}

export function GradingFunLoader({ phase }: GradingFunLoaderProps) {
  if (phase === "idle") {
    return null;
  }
  return <LoaderInner key={phase} phase={phase} />;
}
