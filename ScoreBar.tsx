"use client";

interface ScoreBarProps {
  score: number;
  size?: "sm" | "md";
}

export function ScoreBar({ score, size = "md" }: ScoreBarProps) {
  const color = score >= 65 ? "#00e676" : score >= 40 ? "#ffd600" : "#ff4444";
  const label = score >= 65 ? "Strong" : score >= 40 ? "Moderate" : "Weak";
  const h = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-muted">{label}</span>
      </div>
      <div className={`w-full bg-border rounded-full ${h} overflow-hidden`}>
        <div
          className={`${h} rounded-full transition-all duration-500`}
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}
