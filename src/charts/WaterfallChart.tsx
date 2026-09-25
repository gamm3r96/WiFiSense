import { useEffect, useRef } from "react";

interface Props {
  /** Per-subcarrier amplitude frames, newest last (index-aligned with time buffer). */
  frames: () => Float64Array[];
  subcarriers: number;
  /** Sim-seconds represented per frame (engine tick). */
  framePeriodS: number;
  sourceLabel: string;
  height?: number;
  /** Highlight one subcarrier column (−1 = none). */
  highlight?: number;
}

const PAD = { l: 40, r: 12, t: 14, b: 24 };

/* Color LUT: deep-space blue → teal → sensing green → amber → pale heat. */
const STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [10, 16, 26]],
  [0.22, [16, 52, 74]],
  [0.45, [23, 111, 106]],
  [0.65, [60, 230, 164]],
  [0.85, [242, 179, 76]],
  [1.0, [255, 243, 214]],
];

const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let a = STOPS[0];
    let b = STOPS[STOPS.length - 1];
    for (let s = 0; s < STOPS.length - 1; s++) {
      if (x >= STOPS[s][0] && x <= STOPS[s + 1][0]) {
        a = STOPS[s];
        b = STOPS[s + 1];
        break;
      }
    }
    const f = (x - a[0]) / (b[0] - a[0] || 1);
    lut[i * 3] = a[1][0] + (b[1][0] - a[1][0]) * f;
    lut[i * 3 + 1] = a[1][1] + (b[1][1] - a[1][1]) * f;
    lut[i * 3 + 2] = a[1][2] + (b[1][2] - a[1][2]) * f;
  }
  return lut;
})();

export default function WaterfallChart({
  frames,
  subcarriers,
  framePeriodS,
  sourceLabel,
  height = 240,
  highlight = -1,
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
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, cssW, height);

      const all = frames();
      const plotW = cssW - PAD.l - PAD.r;
      const plotH = height - PAD.t - PAD.b;
      const N = subcarriers;

      // Frame grid + axes first (crisp, under the image).
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.strokeStyle = "rgba(42,59,82,0.5)";
      ctx.strokeRect(PAD.l, PAD.t, plotW, plotH);

      if (all.length < 2) {
        ctx.fillStyle = "#5b6c82";
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("AWAITING SPECTRAL FRAMES", cssW / 2, PAD.t + plotH / 2);
        return;
      }

      const rows = Math.min(all.length, Math.floor(plotH));
      const imgW = Math.max(1, Math.floor(plotW * dpr));
      const imgH = Math.max(1, Math.floor(plotH * dpr));
      const img = ctx.createImageData(imgW, imgH);
      const px = img.data;

      for (let y = 0; y < imgH; y++) {
        // newest frame at the bottom, scrolling upward.
        const rowFromBottom = Math.floor((y / imgH) * rows);
        const frame = all[all.length - 1 - rowFromBottom];
        if (!frame) continue;
        for (let x = 0; x < imgW; x++) {
          const sc = Math.min(N - 1, Math.floor((x / imgW) * N));
          const v = frame[sc];
          const idx = Math.min(255, Math.max(0, Math.round((v / 1.15) * 255))) * 3;
          const o = (y * imgW + x) * 4;
          px[o] = LUT[idx];
          px[o + 1] = LUT[idx + 1];
          px[o + 2] = LUT[idx + 2];
          px[o + 3] = 255;
        }
      }
      ctx.putImageData(img, Math.round(PAD.l * dpr), Math.round(PAD.t * dpr));

      // Highlighted subcarrier column.
      if (highlight >= 0 && highlight < N) {
        const x = PAD.l + (highlight / N) * plotW;
        ctx.strokeStyle = "rgba(90,185,255,0.85)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, PAD.t);
        ctx.lineTo(x + 0.5, PAD.t + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Y axis: elapsed time labels (newest at bottom).
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = "#5b6c82";
      const totalS = rows * framePeriodS;
      for (let i = 0; i <= 3; i++) {
        const y = PAD.t + (plotH * i) / 3;
        const sAgo = totalS - (totalS * i) / 3;
        ctx.fillText(sAgo < 0.05 ? "now" : `-${sAgo.toFixed(0)}s`, PAD.l - 6, y + 3);
      }

      // X axis: subcarrier indices.
      ctx.textAlign = "center";
      for (let sc = 0; sc < N; sc += 5) {
        ctx.fillText(String(sc), PAD.l + ((sc + 0.5) / N) * plotW, height - 8);
      }

      // Axis titles + source.
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("SUBCARRIER INDEX", PAD.l, PAD.t - 4);
      ctx.textAlign = "right";
      ctx.fillText("AMP (NORM) 0 → 1.15", cssW - PAD.r, PAD.t - 4);
      ctx.textAlign = "left";
      ctx.fillStyle = "#5b6c82";
      ctx.fillText(`SRC: ${sourceLabel}`, PAD.l + 4, PAD.t + 12);

      // Colorbar.
      const cbX = cssW - PAD.r - 96;
      const cbY = PAD.t + 22;
      for (let i = 0; i < 64; i++) {
        const idx = Math.round((i / 63) * 255) * 3;
        ctx.fillStyle = `rgb(${LUT[idx]},${LUT[idx + 1]},${LUT[idx + 2]})`;
        ctx.fillRect(cbX + i, cbY, 1, 5);
      }
      ctx.strokeStyle = "rgba(42,59,82,0.8)";
      ctx.strokeRect(cbX - 0.5, cbY - 0.5, 65, 6);
      ctx.fillStyle = "#5b6c82";
      ctx.fillText("0", cbX - 10, cbY + 5);
      ctx.fillText("1.15", cbX + 68, cbY + 5);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, subcarriers, framePeriodS, sourceLabel, height, highlight]);

  return (
    <div className="relative w-full">
      <canvas ref={ref} />
    </div>
  );
}
