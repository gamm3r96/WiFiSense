import { useEffect, useRef } from "react";
import type { DatasetLabel, DatasetSample } from "../types";

interface Props {
  samples: () => DatasetSample[];
  labels: () => DatasetLabel[];
  height?: number;
  sourceLabel: string;
  emptyText?: string;
}

const PAD = { l: 44, r: 14, t: 16, b: 26 };

/**
 * Capture scope: amplitude trace (green area), motion-score overlay (amber)
 * and operator label markers (dashed amber verticals). Used by the live
 * recorder deck and the dataset viewer. RAF-driven; reads fresh data each
 * frame so a growing recording scrolls in real time.
 */
export default function CaptureChart({
  samples,
  labels,
  height = 220,
  sourceLabel,
  emptyText = "AWAITING SAMPLES",
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cssW = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      cssW = parent.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    resize();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!cssW) return;
      ctx.clearRect(0, 0, cssW, height);

      const data = samples();
      const marks = labels();
      const plotW = cssW - PAD.l - PAD.r;
      const plotH = height - PAD.t - PAD.b;

      // Grid + axes.
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      for (const v of [0, 0.5, 1]) {
        const y = PAD.t + plotH - v * plotH;
        ctx.strokeStyle = "rgba(42,59,82,0.5)";
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(cssW - PAD.r, y);
        ctx.stroke();
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(v.toFixed(1), PAD.l - 6, y + 3);
      }

      if (data.length < 2) {
        ctx.fillStyle = "#5b6c82";
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(emptyText, cssW / 2, PAD.t + plotH / 2);
        return;
      }

      // Normalize amplitude + score into 0..1 for the shared axis.
      let minA = Infinity;
      let maxA = -Infinity;
      for (const s of data) {
        if (s.amp < minA) minA = s.amp;
        if (s.amp > maxA) maxA = s.amp;
      }
      const spanA = maxA - minA || 1;
      const t0 = data[0].t;
      const t1 = data[data.length - 1].t;
      const spanT = t1 - t0 || 1;
      const X = (t: number) => PAD.l + ((t - t0) / spanT) * plotW;
      const YA = (a: number) => PAD.t + plotH - ((a - minA) / spanA) * plotH * 0.92 - plotH * 0.04;
      const YS = (s: number) => PAD.t + plotH - Math.min(1, Math.max(0, s)) * plotH;

      // x-axis time labels.
      ctx.textAlign = "center";
      for (let i = 0; i <= 4; i++) {
        const t = t0 + (spanT * i) / 4;
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(`${(t - t0).toFixed(1)}s`, X(t), height - 8);
      }

      // Amplitude area fill.
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = X(data[i].t);
        const y = YA(data[i].amp);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#3ce6a4";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.lineTo(X(t1), PAD.t + plotH);
      ctx.lineTo(X(t0), PAD.t + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + plotH);
      grad.addColorStop(0, "rgba(60,230,164,0.22)");
      grad.addColorStop(1, "rgba(60,230,164,0.01)");
      ctx.fillStyle = grad;
      ctx.fill();

      // Motion-score overlay.
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = X(data[i].t);
        const y = YS(data[i].score);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(242,179,76,0.85)";
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Label markers.
      for (const m of marks) {
        if (m.t < t0 || m.t > t1) continue;
        const x = X(m.t);
        ctx.strokeStyle = "rgba(242,179,76,0.7)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, PAD.t);
        ctx.lineTo(x, PAD.t + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#f2b34c";
        ctx.beginPath();
        ctx.arc(x, PAD.t - 1, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Legend.
      ctx.textAlign = "left";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#3ce6a4";
      ctx.fillRect(PAD.l + 4, PAD.t + 2, 10, 3);
      ctx.fillStyle = "#8fa1b6";
      ctx.fillText("amplitude", PAD.l + 18, PAD.t + 6);
      ctx.fillStyle = "#f2b34c";
      ctx.fillRect(PAD.l + 92, PAD.t + 2, 10, 3);
      ctx.fillStyle = "#8fa1b6";
      ctx.fillText("motion score", PAD.l + 106, PAD.t + 6);

      // Axis titles + source tag.
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#5b6c82";
      ctx.textAlign = "left";
      ctx.fillText("ELAPSED (s)", PAD.l, PAD.t - 6);
      ctx.textAlign = "right";
      ctx.fillText("AMP (NORM) / SCORE", cssW - PAD.r, PAD.t - 6);
      ctx.textAlign = "left";
      ctx.fillText(`SRC: ${sourceLabel}`, PAD.l + 4, height - 8);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, labels, height, sourceLabel, emptyText]);

  return (
    <div className="relative w-full">
      <canvas ref={ref} />
    </div>
  );
}
