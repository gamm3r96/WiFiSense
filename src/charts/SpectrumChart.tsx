import { useEffect, useRef } from "react";

interface Props {
  /** Current per-subcarrier amplitude. */
  data: () => number[];
  /** Static multipath baseline for comparison. */
  baseline: () => number[];
  height?: number;
  sourceLabel: string;
  /** Highlight one subcarrier column (−1 = none). */
  highlight?: number;
}

const PAD = { l: 40, r: 10, t: 14, b: 24 };

export default function SpectrumChart({ data, baseline, height = 190, sourceLabel, highlight = -1 }: Props) {
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

      const cur = data();
      const base = baseline();
      const n = cur.length;
      if (n === 0) {
        ctx.fillStyle = "#5b6c82";
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("AWAITING SAMPLES", cssW / 2, height / 2);
        return;
      }
      const plotW = cssW - PAD.l - PAD.r;
      const plotH = height - PAD.t - PAD.b;
      const yMax = 1.25;
      const Y = (v: number) => PAD.t + plotH - (Math.min(v, yMax) / yMax) * plotH;
      const bw = plotW / n;

      // Grid + y labels.
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      for (const v of [0, 0.25, 0.5, 0.75, 1.0, 1.25]) {
        const y = Y(v);
        ctx.strokeStyle = "rgba(42,59,82,0.5)";
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(cssW - PAD.r, y);
        ctx.stroke();
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(v.toFixed(2), PAD.l - 6, y + 3);
      }
      // x labels: subcarrier index
      ctx.textAlign = "center";
      for (let sc = 0; sc < n; sc += 5) {
        ctx.fillStyle = "#5b6c82";
        ctx.fillText(String(sc), PAD.l + sc * bw + bw / 2, height - 8);
      }
      ctx.textAlign = "left";
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#5b6c82";
      ctx.fillText("SUBCARRIER INDEX", PAD.l, PAD.t - 4);
      ctx.textAlign = "right";
      ctx.fillText("AMP (NORM)", cssW - PAD.r, PAD.t - 4);

      // Bars.
      for (let sc = 0; sc < n; sc++) {
        const x = PAD.l + sc * bw + 1;
        const y = Y(cur[sc]);
        ctx.fillStyle = "rgba(69,216,208,0.75)";
        ctx.fillRect(x, y, Math.max(1.5, bw - 2), PAD.t + plotH - y);
      }

      // Baseline overlay.
      ctx.beginPath();
      for (let sc = 0; sc < n; sc++) {
        const x = PAD.l + sc * bw + bw / 2;
        const y = Y(base[sc]);
        if (sc === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "#8fa1b6";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);

      // Selected subcarrier cursor.
      if (highlight >= 0 && highlight < n) {
        const x = PAD.l + highlight * bw + bw / 2;
        ctx.strokeStyle = "rgba(90,185,255,0.85)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, PAD.t);
        ctx.lineTo(x + 0.5, PAD.t + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Legend.
      ctx.textAlign = "left";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#45d8d0";
      ctx.fillRect(PAD.l + 4, PAD.t + 4, 10, 3);
      ctx.fillStyle = "#8fa1b6";
      ctx.fillText("current frame", PAD.l + 18, PAD.t + 8);
      ctx.strokeStyle = "#8fa1b6";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD.l + 4, PAD.t + 18);
      ctx.lineTo(PAD.l + 14, PAD.t + 18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText("static baseline", PAD.l + 18, PAD.t + 21);

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
  }, [data, baseline, height, sourceLabel, highlight]);

  return (
    <div className="relative w-full">
      <canvas ref={ref} />
    </div>
  );
}
