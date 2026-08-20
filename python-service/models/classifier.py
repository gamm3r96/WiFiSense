"""Activity classification hub — classical scikit-learn models.

Random Forest / SVM / Logistic Regression over CSI feature windows.
Predictions are statistical estimates, never ground truth.
"""

from __future__ import annotations

from typing import Any

import numpy as np


class ModelHub:
    def __init__(self) -> None:
        self.model: Any = None
        self.model_name: str = ""
        self.classes: list[str] = []
        self.fitted: bool = False

    def available_models(self) -> list[str]:
        return ["random_forest", "svm", "logistic"]

    def fit(self, labels: list[str], features: list[list[float]], kind: str) -> tuple[str, dict[str, int]]:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.linear_model import LogisticRegression
        from sklearn.svm import SVC

        X = np.asarray(features, dtype=float)
        y = np.asarray(labels)
        per_class = {c: int((y == c).sum()) for c in sorted(set(labels))}
        if len(per_class) < 2:
            self.fitted = False
            return "need at least two distinct labels", per_class

        if kind == "svm":
            self.model = SVC(probability=True, random_state=42)
        elif kind == "logistic":
            self.model = LogisticRegression(max_iter=1000, random_state=42)
        else:
            self.model = RandomForestClassifier(n_estimators=200, random_state=42)

        self.model.fit(X, y)
        self.classes = sorted(per_class.keys())
        self.model_name = kind
        self.fitted = True
        return f"trained {kind} on {len(y)} windows", per_class

    def predict(self, features: list[float]) -> tuple[str, float, dict[str, float]]:
        if not self.fitted:
            return "UNKNOWN", 0.0, {}
        X = np.asarray(features, dtype=float).reshape(1, -1)
        proba = self.model.predict_proba(X)[0]
        idx = int(np.argmax(proba))
        dist = {str(c): float(p) for c, p in zip(self.model.classes_, proba)}
        return str(self.model.classes_[idx]), float(proba[idx]), dist
