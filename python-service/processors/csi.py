"""CSI signal processing — NumPy mirror of the browser DSP primitives.

Every routine here intentionally matches `src/processing/dsp.ts` so that
local (browser) and remote (Python) backends produce parity results.
"""

from __future__ import annotations

import numpy as np


class CsiProcessor:
    FEATURE_NAMES = ["meanAmp", "stdAmp", "energy", "mobility", "rssiMean", "rssiSd", "motionMean"]

    # ------------------------------ filters -------------------------

    @staticmethod
    def moving_average(v: np.ndarray, window: int) -> np.ndarray:
        w = max(1, int(window))
        c = np.cumsum(np.insert(v, 0, 0.0))
        out = np.empty_like(v, dtype=float)
        for i in range(len(v)):
            lo = max(0, i - w + 1)
            out[i] = (c[i + 1] - c[lo]) / (i - lo + 1)
        return out

    @staticmethod
    def low_pass(v: np.ndarray, alpha: float) -> np.ndarray:
        a = min(1.0, max(0.01, alpha))
        out = np.empty_like(v, dtype=float)
        prev = v[0] if len(v) else 0.0
        for i, x in enumerate(v):
            prev = a * x + (1 - a) * prev
            out[i] = prev
        return out

    @staticmethod
    def high_pass(v: np.ndarray, alpha: float) -> np.ndarray:
        a = min(1.0, max(0.01, alpha))
        out = np.empty_like(v, dtype=float)
        prev_y, prev_x = 0.0, (v[0] if len(v) else 0.0)
        for i, x in enumerate(v):
            prev_y = (1 - a) * (prev_y + x - prev_x)
            prev_x = x
            out[i] = prev_y
        return out

    def filter(self, values: list[float], kind: str, window: int, alpha: float) -> list[float]:
        v = np.asarray(values, dtype=float)
        if v.size == 0:
            return []
        if kind == "moving_average":
            out = self.moving_average(v, window)
        elif kind == "low_pass":
            out = self.low_pass(v, alpha)
        elif kind == "high_pass":
            out = self.high_pass(v, alpha)
        elif kind == "band_pass":
            out = self.low_pass(self.high_pass(v, alpha), alpha)
        elif kind == "median":
            from scipy.ndimage import median_filter as mf

            out = mf(v, size=max(1, window), mode="nearest")
        else:
            out = v
        return [float(x) for x in out]

    # ----------------------------- features -------------------------

    def window_features(self, amps: np.ndarray, rssis: np.ndarray, scores: np.ndarray) -> list[float]:
        if amps.size == 0:
            return [0.0] * len(self.FEATURE_NAMES)
        mean = float(amps.mean())
        diff = float(np.abs(np.diff(amps)).mean()) if amps.size > 1 else 0.0
        mobility = diff / (mean + 1e-6)
        rssi_mean = float(rssis.mean()) if rssis.size else -60.0
        rssi_sd = float(rssis.std()) if rssis.size else 0.0
        motion_mean = float(scores.mean()) if scores.size else 0.0
        return [
            mean,
            float(amps.std()),
            float((amps**2).mean()),
            mobility,
            rssi_mean,
            rssi_sd,
            motion_mean,
        ]

    def windows(
        self,
        amps: list[float],
        rssis: list[float],
        scores: list[float],
        win_len: int,
        hop: int,
    ) -> list[list[float]]:
        a = np.asarray(amps, dtype=float)
        r = np.asarray(rssis, dtype=float) if rssis else np.full(a.shape, -60.0)
        s = np.asarray(scores, dtype=float) if scores else np.zeros(a.shape)
        out: list[list[float]] = []
        for i in range(0, max(0, a.size - win_len + 1), hop):
            out.append(self.window_features(a[i : i + win_len], r[i : i + win_len], s[i : i + win_len]))
        return out
