import { useEffect, useRef } from "react";
import type { SpectrumPoint } from "../processing/dsp";

interface Props {
  data: () => SpectrumPoint[];
  sourceLabel: string;
  height?: number;
  /** Highlight the dominant frequency with a marker line. */
  peakHz?: number;
}

const PAD = { l: 46, r: 12, t: 14, b: 26 };

export default function FFTChart({ data, sourceLabel, height = 200, peakHz }: Props) {
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

      const spec = data();
      const plotW = cssW - PAD.l - PAD.r;
      const plotH = height - PAD.t - PAD.b;

      if (spec.length < 2) {
        ctx.fillStyle = "#5b6c82";
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("AWAITING SPECTRUM", cssW / 2, PAD.t + plotH / 2);
        return;
      }

      const fMax = spec[spec.length - 1].f || 1;
      let mMax = 0;
      for (const p of spec) if (p.mag > mMax) mMax = p.mag;
      if (mMax <= 0) mMax = 1;

      const X = (f: number) => PAD.l + (f / fMax) * plotW;
      const Y = (m: number) => PAD.t + plotH - (m / mMax) * plotH;

      // Grid + y labels (normalised magnitude).
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const v = (mMax * i) / 4;
        const y = Y(v);
        ctx.strokeStyle = "rgba(42,59,82,0.5)";
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(cssW - PAD.r, y);
        ctx.stroke();
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(v.toFixed(2), PAD.l - 6, y + 3);
      }

      // x labels (Hz).
      ctx.textAlign = "center";
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const f = (fMax * i) / steps;
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(f.toFixed(1), X(f), height - 8);
      }
      ctx.textAlign = "left";
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#5b6c82";
      ctx.fillText("FREQUENCY (Hz)", PAD.l, PAD.t - 4);
      ctx.textAlign = "right";
      ctx.fillText("MAGNITUDE", cssW - PAD.r, PAD.t - 4);

      // Bars.
      const bw = Math.max(1, plotW / spec.length - 1);
      for (const p of spec) {
        const x = X(p.f);
        const y = Y(p.mag);
        ctx.fillStyle = "rgba(69,216,208,0.8)";
        ctx.fillRect(x - bw / 2, y, bw, PAD.t + plotH - y);
      }

      // Peak marker.
      if (peakHz !== undefined && peakHz > 0) {
        const x = X(Math.min(peakHz, fMax));
        ctx.strokeStyle = "rgba(242,179,76,0.9)";
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, PAD.t);
        ctx.lineTo(x, PAD.t + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#f2b34c";
        ctx.textAlign = "center";
        ctx.font = "600 10px 'IBM Plex Mono', monospace";
        ctx.fillText(`${peakHz.toFixed(2)} Hz`, x, PAD.t + 10);
      }

      ctx.textAlign = "left";
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#5b6c82";
      ctx.fillText(`SRC: ${sourceLabel}`, PAD.l + 4, height - 8);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sourceLabel, height, peakHz]);

  return (
    <div className="relative w-full">
      <canvas ref={ref} />
    </div>
  );
}
