import { useEffect, useRef } from "react";

export interface SeriesDef {
  label: string;
  color: string;
  data: () => { t: number; v: number }[];
  /** Fixed vertical scale (e.g. a 0..1 motion score drawn on its own axis). */
  domain?: [number, number];
  fill?: boolean;
  width?: number;
}

interface Props {
  series: SeriesDef[];
  unit: string;
  sourceLabel: string;
  windowSec?: number;
  height?: number;
  yFmt?: (v: number) => string;
  tLabel?: (t: number) => string;
  idleText?: string;
}

const PAD = { l: 48, r: 12, t: 12, b: 24 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export default function LineChart({
  series,
  unit,
  sourceLabel,
  windowSec = 30,
  height = 240,
  yFmt = (v) => v.toFixed(2),
  tLabel = (t) => `T+${t.toFixed(0)}s`,
  idleText = "AWAITING SAMPLES",
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      cssW = parent.clientWidth;
      cssH = height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    resize();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!cssW) return;
      ctx.clearRect(0, 0, cssW, cssH);

      // Gather visible points.
      let xMax = -Infinity;
      const visible: { def: SeriesDef; pts: { t: number; v: number }[] }[] = [];
      for (const def of series) {
        const all = def.data();
        for (const p of all) if (p.t > xMax) xMax = p.t;
        visible.push({ def, pts: all });
      }
      if (!isFinite(xMax)) {
        ctx.fillStyle = "#5b6c82";
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(idleText, cssW / 2, cssH / 2);
        return;
      }
      const xMin = xMax - windowSec;
      const plotW = cssW - PAD.l - PAD.r;
      const plotH = cssH - PAD.t - PAD.b;
      const X = (t: number) => PAD.l + ((t - xMin) / windowSec) * plotW;

      // Global domain for un-scaled series.
      let gMin = Infinity;
      let gMax = -Infinity;
      for (const { def, pts } of visible) {
        if (def.domain) continue;
        for (const p of pts) {
          if (p.t < xMin) continue;
          if (p.v < gMin) gMin = p.v;
          if (p.v > gMax) gMax = p.v;
        }
      }
      if (!isFinite(gMin)) {
        gMin = 0;
        gMax = 1;
      }
      const padY = (gMax - gMin) * 0.1 || 0.05;
      gMin -= padY;
      gMax += padY;
      const Y = (v: number, domain?: [number, number]) => {
        const lo = domain ? domain[0] : gMin;
        const hi = domain ? domain[1] : gMax;
        return PAD.t + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
      };

      // Grid + y labels.
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      const ticks = niceTicks(gMin, gMax);
      for (const v of ticks) {
        const y = Y(v);
        ctx.strokeStyle = "rgba(42,59,82,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(cssW - PAD.r, y);
        ctx.stroke();
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(yFmt(v), PAD.l - 7, y + 3);
      }
      // y unit
      ctx.save();
      ctx.translate(11, PAD.t + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillStyle = "#5b6c82";
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillText(unit.toUpperCase(), 0, 0);
      ctx.restore();

      // x labels (timestamps).
      ctx.textAlign = "center";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      for (let i = 0; i <= 4; i++) {
        const t = xMin + (windowSec * i) / 4;
        const x = X(t);
        ctx.strokeStyle = "rgba(42,59,82,0.35)";
        ctx.beginPath();
        ctx.moveTo(x, PAD.t);
        ctx.lineTo(x, PAD.t + plotH);
        ctx.stroke();
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(tLabel(Math.max(0, t)), x, cssH - 8);
      }

      // Series.
      let legendX = cssW - PAD.r;
      ctx.textBaseline = "middle";
      const legendItems: { label: string; color: string; last: number }[] = [];
      for (const { def, pts } of visible) {
        const sel = pts.filter((p) => p.t >= xMin);
        if (sel.length === 0) continue;
        if (def.fill) {
          const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + plotH);
          grad.addColorStop(0, `${def.color}2e`);
          grad.addColorStop(1, `${def.color}00`);
          ctx.beginPath();
          ctx.moveTo(X(sel[0].t), PAD.t + plotH);
          for (const p of sel) ctx.lineTo(X(p.t), Y(p.v, def.domain));
          ctx.lineTo(X(sel[sel.length - 1].t), PAD.t + plotH);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        }
        ctx.beginPath();
        sel.forEach((p, i) => {
          const x = X(p.t);
          const y = Y(p.v, def.domain);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = def.color;
        ctx.lineWidth = def.width ?? 1.6;
        ctx.lineJoin = "round";
        ctx.stroke();
        legendItems.push({ label: def.label, color: def.color, last: sel[sel.length - 1].v });
      }

      // Legend (top-right, inside plot).
      ctx.font = "10px 'IBM Plex Mono', monospace";
      for (let i = legendItems.length - 1; i >= 0; i--) {
        const it = legendItems[i];
        const valStr = yFmt(it.last);
        const textW = ctx.measureText(`${it.label} ${valStr}`).width;
        legendX -= textW + 26;
        ctx.fillStyle = it.color;
        ctx.fillRect(legendX, PAD.t + 2, 10, 3);
        ctx.fillStyle = "#8fa1b6";
        ctx.textAlign = "left";
        ctx.fillText(`${it.label} ${valStr}`, legendX + 14, PAD.t + 4);
      }
      legendX = 0; // silence unused warning path

      // Source tag — provenance is carried by the sourceLabel prop so live
      // hardware streams are never mislabeled as simulated (or vice versa).
      ctx.textAlign = "left";
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#5b6c82";
      ctx.fillText(`SRC: ${sourceLabel}`, PAD.l + 4, cssH - 8);
      ctx.textBaseline = "alphabetic";
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, unit, sourceLabel, windowSec, height]);

  return (
    <div className="relative w-full">
      <canvas ref={ref} />
    </div>
  );
}
