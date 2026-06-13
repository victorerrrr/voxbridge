import { useState } from "react";

const AXES = [
  { label: "Тембр", key: "timbre", tip: "Схожесть тембра" },
  { label: "Диапазон", key: "pitch", tip: "Высота и диапазон" },
  { label: "Голос", key: "vocal_character", tip: "Характер голоса" },
  { label: "Чёткость", key: "quality", tip: "Качество звучания" },
  { label: "Стиль", key: "speaker", tip: "Жанровое соответствие" },
];

interface RadarChartProps {
  timbreScore: number;
  pitchScore: number;
  qualityScore: number;
  vocalCharacterScore: number;
  speakerScore: number;
  size?: number;
}

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function VoiceRadarChart({
  timbreScore, pitchScore, qualityScore, vocalCharacterScore, speakerScore, size = 155,
}: RadarChartProps) {
  const [tooltip, setTooltip] = useState<{ label: string; tip: string; x: number; y: number } | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.33;
  const n = AXES.length;
  const values: Record<string, number> = {
    speakerScore: Math.min(100, Math.max(0, speakerScore ?? 0)),
    timbre: Math.min(100, Math.max(0, timbreScore ?? 0)),
    pitch: Math.min(100, Math.max(0, pitchScore ?? 0)),
    quality: Math.min(100, Math.max(0, qualityScore ?? 0)),
    vocal_character: Math.min(100, Math.max(0, vocalCharacterScore ?? 0)),
  };
  const axisAngles = AXES.map((_, i) => (360 / n) * i);
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((level) => {
    const pts = axisAngles.map((angle) => {
      const p = polarToXY(angle, maxR * level, cx, cy);
      return `${p.x},${p.y}`;
    });
    return pts.join(" ");
  });
  const dataPoints = AXES.map((axis, i) => {
    const val = axis.key === "speaker" ? values["speakerScore"] : values[axis.key] ?? 0;
    return polarToXY(axisAngles[i], (val / 100) * maxR, cx, cy);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const labelPoints = axisAngles.map((angle) => polarToXY(angle, maxR * 1.28, cx, cy));
  return (
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        {gridPolygons.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth="0.8" />
        ))}
        {axisAngles.map((angle, i) => {
          const end = polarToXY(angle, maxR, cx, cy);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(139,92,246,0.22)" strokeWidth="0.8" />;
        })}
        <polygon points={dataPolygon} fill="rgba(139,92,246,0.22)" stroke="rgba(139,92,246,0.85)" strokeWidth="1.5" />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.2" fill="rgba(139,92,246,1)" />
        ))}
        {labelPoints.map((p, i) => (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fill="rgba(255,255,255,0.55)" fontFamily="system-ui, sans-serif"
            style={{ cursor: "help" }}
            onMouseEnter={() => setTooltip({ label: AXES[i].label, tip: AXES[i].tip, x: p.x, y: p.y })}
            onMouseLeave={() => setTooltip(null)}
          >
            {AXES[i].label}
          </text>
        ))}
      </svg>
      {tooltip && (
        <div className="absolute z-50 pointer-events-none px-2 py-1 rounded text-xs text-white bg-zinc-800 border border-zinc-600 whitespace-nowrap shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 30, transform: "translateX(-50%)" }}>
          <span className="font-medium">{tooltip.label}:</span> {tooltip.tip}
        </div>
      )}
    </div>
  );
}
