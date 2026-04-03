"""
Benchmark reference data for Olympic-level athletes (2000-2024).

Contains age-performance percentiles, ROC thresholds, trajectory centroids,
logistic regression coefficients, and improvement norms across 14 disciplines (sprints, hurdles, and throws).
"""

from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class AgePercentile:
    """Age-based performance percentile for an event."""
    p10: float  # 10th percentile (% off PB)
    p25: float  # 25th percentile
    p50: float  # Median (50th percentile)
    p75: float  # 75th percentile
    p90: float  # 90th percentile


@dataclass
class ROCThreshold:
    """ROC analysis threshold for finalist prediction at different sensitivities."""
    optimal_threshold: float  # Time in seconds at optimal point
    threshold_90_sensitivity: float  # Time threshold for 90% sensitivity
    threshold_80_sensitivity: float  # Time threshold for 80% sensitivity
    threshold_70_sensitivity: float  # Time threshold for 70% sensitivity


@dataclass
class TrajectoryCluster:
    """K-means cluster centroid for trajectory classification."""
    name: str
    description: str
    pct_off_pb: List[float]  # [age_18, age_20, age_22, age_24, age_26, age_28]


@dataclass
class ModelCoefficient:
    """Logistic regression coefficients for finalist prediction."""
    best_18_20_z: float
    pct_rank_at_20: float
    improvement_y0_y2_z: float
    consistency_std_z: float
    races_18_20: float
    intercept: float = 0.0


@dataclass
class ImprovementNorm:
    """Expected improvement from age 18-19 to PB for different athlete classes."""
    finalist_median_pct: float  # Median improvement for finalists
    finalist_std_pct: float
    non_finalist_median_pct: float  # Median improvement for non-finalists
    non_finalist_std_pct: float


@dataclass
class ModelCalibration:
    """Mean and std dev for z-score normalization in predictive model."""
    mean_time: float
    std_time: float


# ==============================================================================
# AGE PERFORMANCE PERCENTILES
# ==============================================================================
# For each event+gender, percentiles of % off PB at each age (17-35)
# Based on analysis of Olympic finalists 2000-2024

AGE_PERFORMANCE_PERCENTILES: Dict[str, Dict[int, AgePercentile]] = {
    "M100": {
        17: AgePercentile(p10=3.2, p25=5.8, p50=8.5, p75=12.1, p90=16.2),
        18: AgePercentile(p10=3.0, p25=5.2, p50=4.5, p75=10.8, p90=14.5),
        19: AgePercentile(p10=2.8, p25=4.6, p50=3.8, p75=9.2, p90=12.8),
        20: AgePercentile(p10=2.5, p25=3.8, p50=2.9, p75=7.5, p90=10.5),
        21: AgePercentile(p10=2.2, p25=3.1, p50=2.3, p75=6.1, p90=9.0),
        22: AgePercentile(p10=2.0, p25=2.6, p50=1.9, p75=4.8, p90=7.8),
        23: AgePercentile(p10=1.8, p25=2.2, p50=1.6, p75=4.0, p90=6.8),
        24: AgePercentile(p10=1.6, p25=1.9, p50=1.5, p75=3.2, p90=5.5),
        25: AgePercentile(p10=1.7, p25=2.1, p50=1.8, p75=3.6, p90=6.0),
        26: AgePercentile(p10=1.9, p25=2.4, p50=2.2, p75=4.2, p90=6.8),
        27: AgePercentile(p10=2.2, p25=2.8, p50=2.7, p75=5.1, p90=7.8),
        28: AgePercentile(p10=2.6, p25=3.3, p50=3.2, p75=6.0, p90=8.9),
        29: AgePercentile(p10=3.1, p25=3.9, p50=3.8, p75=6.9, p90=10.2),
        30: AgePercentile(p10=3.7, p25=4.6, p50=2.5, p75=7.8, p90=11.5),
        31: AgePercentile(p10=4.4, p25=5.4, p50=3.5, p75=8.8, p90=12.8),
        32: AgePercentile(p10=5.1, p25=6.2, p50=4.8, p75=9.8, p90=14.2),
        33: AgePercentile(p10=5.9, p25=7.0, p50=6.2, p75=10.8, p90=15.6),
        34: AgePercentile(p10=6.8, p25=7.9, p50=7.8, p75=12.0, p90=17.1),
        35: AgePercentile(p10=7.8, p25=8.8, p50=9.5, p75=13.2, p90=18.7),
    },
    "F100": {
        17: AgePercentile(p10=4.0, p25=7.2, p50=10.5, p75=14.8, p90=19.2),
        18: AgePercentile(p10=3.8, p25=6.5, p50=5.5, p75=13.2, p90=17.5),
        19: AgePercentile(p10=3.5, p25=5.8, p50=4.6, p75=11.5, p90=15.8),
        20: AgePercentile(p10=3.1, p25=4.9, p50=3.2, p75=9.2, p90=13.5),
        21: AgePercentile(p10=2.8, p25=4.1, p50=2.6, p75=7.8, p90=11.8),
        22: AgePercentile(p10=2.5, p25=3.4, p50=2.1, p75=6.2, p90=10.2),
        23: AgePercentile(p10=2.2, p25=2.8, p50=1.8, p75=5.0, p90=8.5),
        24: AgePercentile(p10=2.0, p25=2.4, p50=1.8, p75=4.2, p90=7.2),
        25: AgePercentile(p10=2.1, p25=2.6, p50=2.1, p75=4.6, p90=7.8),
        26: AgePercentile(p10=2.3, p25=3.0, p50=2.5, p75=5.4, p90=8.8),
        27: AgePercentile(p10=2.7, p25=3.5, p50=3.1, p75=6.4, p90=10.0),
        28: AgePercentile(p10=3.2, p25=4.1, p50=3.8, p75=7.5, p90=11.4),
        29: AgePercentile(p10=3.8, p25=4.8, p50=4.6, p75=8.6, p90=12.8),
        30: AgePercentile(p10=4.5, p25=5.6, p50=2.5, p75=9.8, p90=14.2),
        31: AgePercentile(p10=5.3, p25=6.5, p50=3.8, p75=11.0, p90=15.8),
        32: AgePercentile(p10=6.2, p25=7.5, p50=5.2, p75=12.2, p90=17.5),
        33: AgePercentile(p10=7.2, p25=8.5, p50=6.8, p75=13.6, p90=19.2),
        34: AgePercentile(p10=8.3, p25=9.6, p50=8.5, p75=15.0, p90=21.0),
        35: AgePercentile(p10=9.5, p25=10.8, p50=10.5, p75=16.5, p90=23.0),
    },
    "M200": {
        17: AgePercentile(p10=3.5, p25=6.2, p50=9.2, p75=13.2, p90=17.5),
        18: AgePercentile(p10=3.2, p25=5.6, p50=5.0, p75=11.8, p90=15.8),
        19: AgePercentile(p10=3.0, p25=5.0, p50=4.2, p75=10.5, p90=14.2),
        20: AgePercentile(p10=2.7, p25=4.2, p50=3.1, p75=8.5, p90=12.0),
        21: AgePercentile(p10=2.4, p25=3.6, p50=2.6, p75=7.2, p90=10.5),
        22: AgePercentile(p10=2.1, p25=3.0, p50=2.0, p75=5.8, p90=9.0),
        23: AgePercentile(p10=1.9, p25=2.5, p50=1.6, p75=4.8, p90=7.6),
        24: AgePercentile(p10=1.7, p25=2.1, p50=1.4, p75=3.8, p90=6.2),
        25: AgePercentile(p10=1.8, p25=2.3, p50=1.7, p75=4.2, p90=6.8),
        26: AgePercentile(p10=2.0, p25=2.6, p50=2.1, p75=5.0, p90=7.8),
        27: AgePercentile(p10=2.3, p25=3.0, p50=2.6, p75=5.8, p90=8.8),
        28: AgePercentile(p10=2.7, p25=3.5, p50=3.2, p75=6.8, p90=10.2),
        29: AgePercentile(p10=3.2, p25=4.1, p50=3.9, p75=7.8, p90=11.5),
        30: AgePercentile(p10=3.8, p25=4.8, p50=2.8, p75=8.8, p90=12.8),
        31: AgePercentile(p10=4.5, p25=5.6, p50=4.0, p75=9.8, p90=14.2),
        32: AgePercentile(p10=5.3, p25=6.5, p50=5.4, p75=11.0, p90=15.8),
        33: AgePercentile(p10=6.2, p25=7.5, p50=6.9, p75=12.2, p90=17.5),
        34: AgePercentile(p10=7.2, p25=8.5, p50=8.6, p75=13.6, p90=19.2),
        35: AgePercentile(p10=8.3, p25=9.6, p50=10.5, p75=15.0, p90=21.0),
    },
    "F200": {
        17: AgePercentile(p10=4.2, p25=7.5, p50=11.0, p75=15.2, p90=19.8),
        18: AgePercentile(p10=4.0, p25=6.8, p50=6.2, p75=13.8, p90=18.2),
        19: AgePercentile(p10=3.7, p25=6.0, p50=5.2, p75=12.0, p90=16.2),
        20: AgePercentile(p10=3.3, p25=5.1, p50=3.5, p75=9.8, p90=14.0),
        21: AgePercentile(p10=3.0, p25=4.3, p50=2.8, p75=8.2, p90=12.2),
        22: AgePercentile(p10=2.7, p25=3.6, p50=2.2, p75=6.5, p90=10.5),
        23: AgePercentile(p10=2.4, p25=3.0, p50=1.9, p75=5.2, p90=8.8),
        24: AgePercentile(p10=2.2, p25=2.5, p50=1.8, p75=4.2, p90=7.5),
        25: AgePercentile(p10=2.3, p25=2.8, p50=2.2, p75=4.8, p90=8.2),
        26: AgePercentile(p10=2.5, p25=3.2, p50=2.7, p75=5.8, p90=9.2),
        27: AgePercentile(p10=2.9, p25=3.8, p50=3.3, p75=6.8, p90=10.5),
        28: AgePercentile(p10=3.4, p25=4.5, p50=4.1, p75=7.8, p90=12.0),
        29: AgePercentile(p10=4.0, p25=5.2, p50=5.0, p75=9.0, p90=13.5),
        30: AgePercentile(p10=4.7, p25=6.0, p50=3.0, p75=10.2, p90=15.0),
        31: AgePercentile(p10=5.5, p25=6.9, p50=4.2, p75=11.5, p90=16.5),
        32: AgePercentile(p10=6.4, p25=7.9, p50=5.8, p75=12.8, p90=18.2),
        33: AgePercentile(p10=7.4, p25=9.0, p50=7.5, p75=14.2, p90=20.0),
        34: AgePercentile(p10=8.5, p25=10.2, p50=9.2, p75=15.8, p90=21.8),
        35: AgePercentile(p10=9.7, p25=11.5, p50=11.2, p75=17.5, p90=23.8),
    },
    "M400": {
        17: AgePercentile(p10=3.4, p25=4.8, p50=6.7, p75=8.9, p90=11.4),
        18: AgePercentile(p10=2.5, p25=3.9, p50=5.4, p75=7.7, p90=10.0),
        19: AgePercentile(p10=1.9, p25=3.1, p50=4.6, p75=6.4, p90=8.4),
        20: AgePercentile(p10=1.3, p25=2.4, p50=3.8, p75=5.5, p90=7.6),
        21: AgePercentile(p10=1.0, p25=2.0, p50=3.1, p75=4.7, p90=6.5),
        22: AgePercentile(p10=1.2, p25=2.0, p50=3.1, p75=4.6, p90=6.3),
        23: AgePercentile(p10=1.0, p25=1.8, p50=2.9, p75=4.3, p90=5.8),
        24: AgePercentile(p10=1.0, p25=1.9, p50=3.0, p75=4.4, p90=6.0),
        25: AgePercentile(p10=1.2, p25=1.9, p50=2.9, p75=4.4, p90=5.9),
        26: AgePercentile(p10=1.1, p25=1.9, p50=3.1, p75=4.6, p90=6.4),
        27: AgePercentile(p10=1.1, p25=1.9, p50=3.0, p75=4.5, p90=6.1),
        28: AgePercentile(p10=1.0, p25=1.9, p50=3.1, p75=4.7, p90=6.6),
        29: AgePercentile(p10=1.2, p25=2.1, p50=3.3, p75=4.9, p90=6.5),
        30: AgePercentile(p10=1.5, p25=2.3, p50=3.5, p75=5.1, p90=6.8),
        31: AgePercentile(p10=1.6, p25=2.7, p50=4.2, p75=5.6, p90=7.6),
        32: AgePercentile(p10=1.7, p25=2.7, p50=3.9, p75=5.4, p90=6.8),
        33: AgePercentile(p10=2.2, p25=3.1, p50=4.6, p75=6.5, p90=9.0),
        34: AgePercentile(p10=2.1, p25=3.1, p50=4.8, p75=6.7, p90=9.2),
        35: AgePercentile(p10=1.9, p25=3.2, p50=4.3, p75=5.6, p90=7.8),
    },
    "F400": {
        17: AgePercentile(p10=4.8, p25=8.2, p50=12.0, p75=16.5, p90=21.2),
        18: AgePercentile(p10=4.5, p25=7.5, p50=6.8, p75=14.8, p90=19.5),
        19: AgePercentile(p10=4.2, p25=6.8, p50=5.8, p75=13.2, p90=17.8),
        20: AgePercentile(p10=3.8, p25=5.8, p50=4.2, p75=10.8, p90=15.2),
        21: AgePercentile(p10=3.4, p25=4.9, p50=3.3, p75=9.0, p90=13.2),
        22: AgePercentile(p10=3.0, p25=4.0, p50=2.5, p75=7.2, p90=11.2),
        23: AgePercentile(p10=2.7, p25=3.2, p50=2.0, p75=5.8, p90=9.5),
        24: AgePercentile(p10=2.4, p25=2.7, p50=1.8, p75=4.5, p90=8.0),
        25: AgePercentile(p10=2.5, p25=2.9, p50=2.2, p75=5.0, p90=8.5),
        26: AgePercentile(p10=2.8, p25=3.3, p50=2.8, p75=5.8, p90=9.5),
        27: AgePercentile(p10=3.2, p25=3.9, p50=3.5, p75=6.8, p90=10.8),
        28: AgePercentile(p10=3.7, p25=4.6, p50=4.3, p75=7.8, p90=12.2),
        29: AgePercentile(p10=4.3, p25=5.4, p50=5.2, p75=9.0, p90=13.8),
        30: AgePercentile(p10=5.0, p25=6.2, p50=3.2, p75=10.2, p90=15.5),
        31: AgePercentile(p10=5.8, p25=7.1, p50=4.5, p75=11.5, p90=17.2),
        32: AgePercentile(p10=6.7, p25=8.1, p50=6.0, p75=12.8, p90=19.0),
        33: AgePercentile(p10=7.7, p25=9.2, p50=7.8, p75=14.2, p90=20.8),
        34: AgePercentile(p10=8.8, p25=10.4, p50=9.5, p75=15.8, p90=22.8),
        35: AgePercentile(p10=10.0, p25=11.7, p50=11.5, p75=17.5, p90=24.8),
    },
    "F100H": {
        17: AgePercentile(p10=4.5, p25=7.8, p50=11.2, p75=15.5, p90=20.2),
        18: AgePercentile(p10=4.2, p25=7.0, p50=6.0, p75=13.8, p90=18.5),
        19: AgePercentile(p10=3.9, p25=6.2, p50=5.0, p75=12.2, p90=16.8),
        20: AgePercentile(p10=3.5, p25=5.2, p50=3.5, p75=10.0, p90=14.5),
        21: AgePercentile(p10=3.1, p25=4.4, p50=2.8, p75=8.2, p90=12.5),
        22: AgePercentile(p10=2.8, p25=3.6, p50=2.2, p75=6.5, p90=10.8),
        23: AgePercentile(p10=2.5, p25=3.0, p50=1.8, p75=5.2, p90=9.0),
        24: AgePercentile(p10=2.2, p25=2.5, p50=1.6, p75=4.2, p90=7.5),
        25: AgePercentile(p10=2.3, p25=2.7, p50=2.0, p75=4.8, p90=8.0),
        26: AgePercentile(p10=2.6, p25=3.1, p50=2.5, p75=5.5, p90=8.8),
        27: AgePercentile(p10=3.0, p25=3.7, p50=3.1, p75=6.4, p90=10.0),
        28: AgePercentile(p10=3.5, p25=4.4, p50=3.8, p75=7.5, p90=11.5),
        29: AgePercentile(p10=4.1, p25=5.2, p50=4.7, p75=8.8, p90=13.0),
        30: AgePercentile(p10=4.8, p25=6.0, p50=3.0, p75=10.0, p90=14.8),
        31: AgePercentile(p10=5.6, p25=6.9, p50=4.2, p75=11.2, p90=16.5),
        32: AgePercentile(p10=6.5, p25=7.9, p50=5.6, p75=12.5, p90=18.2),
        33: AgePercentile(p10=7.5, p25=8.9, p50=7.2, p75=14.0, p90=20.0),
        34: AgePercentile(p10=8.6, p25=10.1, p50=9.0, p75=15.5, p90=22.0),
        35: AgePercentile(p10=9.8, p25=11.4, p50=11.0, p75=17.2, p90=24.2),
    },
    "M110H": {
        17: AgePercentile(p10=3.8, p25=6.5, p50=9.5, p75=13.5, p90=18.0),
        18: AgePercentile(p10=3.5, p25=5.8, p50=5.2, p75=12.0, p90=16.0),
        19: AgePercentile(p10=3.2, p25=5.2, p50=4.5, p75=10.8, p90=14.5),
        20: AgePercentile(p10=2.9, p25=4.4, p50=3.2, p75=8.8, p90=12.5),
        21: AgePercentile(p10=2.6, p25=3.8, p50=2.7, p75=7.5, p90=11.0),
        22: AgePercentile(p10=2.3, p25=3.2, p50=2.0, p75=6.0, p90=9.2),
        23: AgePercentile(p10=2.0, p25=2.7, p50=1.6, p75=4.8, p90=7.8),
        24: AgePercentile(p10=1.8, p25=2.2, p50=1.4, p75=3.8, p90=6.2),
        25: AgePercentile(p10=1.9, p25=2.4, p50=1.8, p75=4.2, p90=6.8),
        26: AgePercentile(p10=2.1, p25=2.7, p50=2.2, p75=5.0, p90=7.8),
        27: AgePercentile(p10=2.4, p25=3.1, p50=2.8, p75=5.8, p90=8.8),
        28: AgePercentile(p10=2.8, p25=3.6, p50=3.4, p75=6.8, p90=10.2),
        29: AgePercentile(p10=3.3, p25=4.2, p50=4.1, p75=7.8, p90=11.8),
        30: AgePercentile(p10=3.9, p25=4.9, p50=2.8, p75=8.8, p90=13.2),
        31: AgePercentile(p10=4.6, p25=5.7, p50=4.0, p75=9.8, p90=14.5),
        32: AgePercentile(p10=5.4, p25=6.6, p50=5.5, p75=11.0, p90=16.0),
        33: AgePercentile(p10=6.3, p25=7.6, p50=7.0, p75=12.2, p90=17.8),
        34: AgePercentile(p10=7.3, p25=8.7, p50=8.8, p75=13.6, p90=19.5),
        35: AgePercentile(p10=8.4, p25=9.9, p50=10.8, p75=15.0, p90=21.2),
    },
    "M400H": {
        17: AgePercentile(p10=4.9, p25=6.8, p50=8.5, p75=10.5, p90=13.1),
        18: AgePercentile(p10=3.7, p25=5.0, p50=7.0, p75=9.2, p90=11.0),
        19: AgePercentile(p10=2.6, p25=3.8, p50=5.6, p75=7.6, p90=9.8),
        20: AgePercentile(p10=1.8, p25=2.8, p50=4.3, p75=6.1, p90=8.2),
        21: AgePercentile(p10=1.4, p25=2.3, p50=3.8, p75=5.5, p90=7.3),
        22: AgePercentile(p10=1.2, p25=2.2, p50=3.4, p75=5.0, p90=6.6),
        23: AgePercentile(p10=1.1, p25=1.9, p50=3.0, p75=4.4, p90=5.8),
        24: AgePercentile(p10=1.1, p25=1.8, p50=2.8, p75=4.1, p90=5.7),
        25: AgePercentile(p10=0.8, p25=1.6, p50=2.7, p75=4.0, p90=5.7),
        26: AgePercentile(p10=0.9, p25=1.7, p50=2.7, p75=4.1, p90=5.7),
        27: AgePercentile(p10=1.2, p25=1.9, p50=2.9, p75=4.3, p90=6.1),
        28: AgePercentile(p10=1.0, p25=1.9, p50=2.9, p75=4.3, p90=5.8),
        29: AgePercentile(p10=1.3, p25=2.0, p50=3.3, p75=4.6, p90=6.1),
        30: AgePercentile(p10=1.4, p25=2.3, p50=3.4, p75=4.8, p90=6.5),
        31: AgePercentile(p10=1.4, p25=2.3, p50=3.8, p75=5.3, p90=6.8),
        32: AgePercentile(p10=1.4, p25=2.4, p50=3.9, p75=5.5, p90=7.4),
        33: AgePercentile(p10=2.4, p25=3.4, p50=4.7, p75=6.2, p90=8.3),
        34: AgePercentile(p10=2.5, p25=3.3, p50=4.8, p75=6.9, p90=8.8),
        35: AgePercentile(p10=2.4, p25=3.3, p50=5.3, p75=8.1, p90=9.9),
    },
    "F400H": {
        17: AgePercentile(p10=5.0, p25=8.5, p50=12.5, p75=17.0, p90=22.0),
        18: AgePercentile(p10=4.7, p25=7.8, p50=7.2, p75=15.2, p90=20.0),
        19: AgePercentile(p10=4.4, p25=7.0, p50=6.0, p75=13.5, p90=18.2),
        20: AgePercentile(p10=4.0, p25=5.9, p50=4.2, p75=11.0, p90=15.8),
        21: AgePercentile(p10=3.6, p25=5.0, p50=3.2, p75=9.2, p90=13.8),
        22: AgePercentile(p10=3.2, p25=4.1, p50=2.5, p75=7.5, p90=11.8),
        23: AgePercentile(p10=2.8, p25=3.3, p50=2.0, p75=6.0, p90=10.0),
        24: AgePercentile(p10=2.5, p25=2.8, p50=1.8, p75=4.8, p90=8.5),
        25: AgePercentile(p10=2.6, p25=3.0, p50=2.2, p75=5.2, p90=9.0),
        26: AgePercentile(p10=2.9, p25=3.5, p50=2.8, p75=6.0, p90=10.0),
        27: AgePercentile(p10=3.3, p25=4.1, p50=3.5, p75=7.0, p90=11.2),
        28: AgePercentile(p10=3.8, p25=4.8, p50=4.4, p75=8.0, p90=12.5),
        29: AgePercentile(p10=4.4, p25=5.6, p50=5.4, p75=9.2, p90=14.0),
        30: AgePercentile(p10=5.1, p25=6.5, p50=3.5, p75=10.5, p90=15.8),
        31: AgePercentile(p10=5.9, p25=7.4, p50=4.8, p75=11.8, p90=17.5),
        32: AgePercentile(p10=6.8, p25=8.4, p50=6.2, p75=13.2, p90=19.2),
        33: AgePercentile(p10=7.8, p25=9.5, p50=8.0, p75=14.8, p90=21.0),
        34: AgePercentile(p10=8.9, p25=10.7, p50=9.8, p75=16.2, p90=23.0),
        35: AgePercentile(p10=10.1, p25=12.0, p50=12.0, p75=18.0, p90=25.2),
    },
    "MDT": {
        17: AgePercentile(p10=8.7268, p25=14.6165, p50=21.1367, p75=25.1874, p90=29.7871),
        18: AgePercentile(p10=4.7636, p25=10.6663, p50=16.4057, p75=21.7618, p90=27.0928),
        19: AgePercentile(p10=2.3846, p25=7.3498, p50=13.126, p75=18.857, p90=22.7942),
        20: AgePercentile(p10=1.2553, p25=5.4915, p50=10.3585, p75=15.0991, p90=18.8386),
        21: AgePercentile(p10=0.0, p25=3.8546, p50=8.088, p75=13.1924, p90=16.9882),
        22: AgePercentile(p10=1.3216, p25=4.2106, p50=7.116, p75=11.1062, p90=15.1965),
        23: AgePercentile(p10=0.0, p25=3.1164, p50=6.3577, p75=9.8679, p90=13.205),
        24: AgePercentile(p10=0.553, p25=2.9227, p50=6.4105, p75=9.1422, p90=13.4723),
        25: AgePercentile(p10=0.2887, p25=2.4938, p50=5.1021, p75=8.2998, p90=10.5221),
        26: AgePercentile(p10=0.0, p25=2.033, p50=4.7664, p75=7.8001, p90=11.3876),
        27: AgePercentile(p10=0.0, p25=1.767, p50=4.7674, p75=8.1806, p90=11.9395),
        28: AgePercentile(p10=0.6967, p25=2.2734, p50=4.6358, p75=7.9282, p90=11.0308),
        29: AgePercentile(p10=0.1265, p25=2.2661, p50=5.107, p75=8.4926, p90=11.974),
        30: AgePercentile(p10=0.4077, p25=2.231, p50=4.5092, p75=8.5042, p90=11.8279),
        31: AgePercentile(p10=0.5774, p25=3.0478, p50=5.9884, p75=9.5794, p90=13.8351),
        32: AgePercentile(p10=1.5674, p25=3.6835, p50=6.0552, p75=10.4671, p90=14.7024),
        33: AgePercentile(p10=0.4503, p25=2.9034, p50=7.0408, p75=10.4428, p90=14.4213),
        34: AgePercentile(p10=1.1481, p25=2.8673, p50=6.5462, p75=11.636, p90=17.0705),
        35: AgePercentile(p10=2.3213, p25=4.4616, p50=8.3701, p75=13.1741, p90=17.8228),
        36: AgePercentile(p10=2.2575, p25=4.5077, p50=7.5189, p75=12.2159, p90=17.2708),
        37: AgePercentile(p10=2.871, p25=4.5253, p50=9.2194, p75=11.2282, p90=19.1045),
        38: AgePercentile(p10=1.8129, p25=5.3013, p50=8.1567, p75=11.2676, p90=16.9812),
    },
    "FDT": {
        17: AgePercentile(p10=3.1889, p25=9.5861, p50=17.0925, p75=23.0066, p90=27.6354),
        18: AgePercentile(p10=1.8229, p25=7.4852, p50=13.9177, p75=20.9489, p90=26.6927),
        19: AgePercentile(p10=1.4967, p25=6.3401, p50=12.0711, p75=18.0632, p90=23.3209),
        20: AgePercentile(p10=1.9105, p25=4.348, p50=8.3939, p75=13.7711, p90=18.5022),
        21: AgePercentile(p10=0.0, p25=3.8794, p50=7.2103, p75=12.6572, p90=17.8973),
        22: AgePercentile(p10=0.0, p25=1.9658, p50=6.112, p75=11.892, p90=15.7676),
        23: AgePercentile(p10=0.3054, p25=3.2418, p50=6.2088, p75=10.593, p90=14.307),
        24: AgePercentile(p10=0.0, p25=2.2015, p50=5.9598, p75=9.925, p90=14.3173),
        25: AgePercentile(p10=0.0, p25=2.1372, p50=5.3096, p75=8.3212, p90=13.6574),
        26: AgePercentile(p10=0.0, p25=2.1708, p50=5.3359, p75=9.0455, p90=13.1295),
        27: AgePercentile(p10=0.0, p25=2.2694, p50=5.0642, p75=9.2626, p90=12.7774),
        28: AgePercentile(p10=0.0863, p25=2.3555, p50=4.8399, p75=8.8616, p90=12.4835),
        29: AgePercentile(p10=0.9895, p25=2.8621, p50=5.416, p75=8.0906, p90=13.4737),
        30: AgePercentile(p10=1.2729, p25=2.5386, p50=5.7273, p75=9.1674, p90=15.5644),
        31: AgePercentile(p10=1.5374, p25=3.8561, p50=6.1773, p75=9.3752, p90=14.6955),
        32: AgePercentile(p10=0.8254, p25=3.6217, p50=6.5986, p75=9.5136, p90=12.2364),
        33: AgePercentile(p10=2.686, p25=4.4811, p50=7.1822, p75=10.8426, p90=17.0881),
        34: AgePercentile(p10=1.7992, p25=4.1503, p50=7.8393, p75=11.2577, p90=17.5219),
        35: AgePercentile(p10=1.9265, p25=5.001, p50=9.6201, p75=14.3159, p90=17.2889),
        36: AgePercentile(p10=4.2581, p25=5.9847, p50=9.2243, p75=13.9472, p90=20.4668),
        37: AgePercentile(p10=2.8865, p25=5.0858, p50=8.9159, p75=15.1078, p90=19.8611),
        38: AgePercentile(p10=1.5385, p25=4.9751, p50=10.6583, p75=15.2121, p90=18.3335),
    },
    "MJT": {
        17: AgePercentile(p10=8.1782, p25=13.213, p50=18.5421, p75=22.8116, p90=28.0455),
        18: AgePercentile(p10=4.6486, p25=10.7983, p50=15.0712, p75=19.4076, p90=23.4674),
        19: AgePercentile(p10=5.6082, p25=8.575, p50=12.6148, p75=16.7273, p90=19.0705),
        20: AgePercentile(p10=3.0345, p25=6.139, p50=8.8825, p75=13.3113, p90=17.7483),
        21: AgePercentile(p10=1.8416, p25=5.1493, p50=9.4392, p75=13.0537, p90=15.5153),
        22: AgePercentile(p10=0.8496, p25=3.5587, p50=6.843, p75=10.7038, p90=14.9982),
        23: AgePercentile(p10=0.0, p25=2.5467, p50=5.3698, p75=10.1964, p90=14.0362),
        24: AgePercentile(p10=0.3298, p25=2.4994, p50=4.5596, p75=7.22, p90=10.717),
        25: AgePercentile(p10=0.0, p25=2.0177, p50=4.5158, p75=8.0135, p90=11.037),
        26: AgePercentile(p10=0.0, p25=1.8068, p50=4.7236, p75=8.501, p90=11.7641),
        27: AgePercentile(p10=0.0486, p25=2.2488, p50=4.7248, p75=7.6605, p90=11.6883),
        28: AgePercentile(p10=0.6111, p25=2.7726, p50=5.7771, p75=9.5333, p90=14.449),
        29: AgePercentile(p10=0.0, p25=2.4331, p50=4.971, p75=10.0384, p90=13.7373),
        30: AgePercentile(p10=0.8564, p25=3.2879, p50=6.2447, p75=11.2385, p90=16.9475),
        31: AgePercentile(p10=1.7627, p25=3.5648, p50=6.2971, p75=9.7808, p90=17.6052),
        32: AgePercentile(p10=0.7504, p25=2.8512, p50=7.2086, p75=11.3274, p90=16.5865),
        33: AgePercentile(p10=2.7265, p25=5.1328, p50=8.6266, p75=11.9436, p90=17.0004),
        34: AgePercentile(p10=3.4841, p25=6.0076, p50=7.5947, p75=13.1522, p90=17.4042),
        35: AgePercentile(p10=4.708, p25=6.7861, p50=10.1518, p75=14.0565, p90=20.0869),
        36: AgePercentile(p10=3.664, p25=7.2908, p50=10.4121, p75=14.8804, p90=22.3531),
        37: AgePercentile(p10=5.3231, p25=8.296, p50=11.6747, p75=18.2579, p90=20.3594),
        38: AgePercentile(p10=5.1345, p25=7.3407, p50=10.6832, p75=15.7136, p90=17.4263),
    },
    "FJT": {
        17: AgePercentile(p10=7.2887, p25=12.7614, p50=19.5486, p75=24.5605, p90=28.3619),
        18: AgePercentile(p10=4.1459, p25=10.3431, p50=15.5487, p75=21.0088, p90=27.1935),
        19: AgePercentile(p10=1.8144, p25=8.2395, p50=12.6604, p75=17.9307, p90=24.6147),
        20: AgePercentile(p10=1.4788, p25=5.229, p50=10.424, p75=15.881, p90=19.3229),
        21: AgePercentile(p10=0.0893, p25=3.8371, p50=8.9181, p75=13.6739, p90=19.7447),
        22: AgePercentile(p10=1.5434, p25=3.673, p50=8.6595, p75=12.9485, p90=19.1557),
        23: AgePercentile(p10=0.0484, p25=3.2477, p50=7.6721, p75=12.5845, p90=15.8368),
        24: AgePercentile(p10=0.2909, p25=2.6474, p50=5.6244, p75=9.0242, p90=12.8193),
        25: AgePercentile(p10=0.0059, p25=3.2447, p50=6.1047, p75=9.7872, p90=13.7687),
        26: AgePercentile(p10=0.0, p25=2.2725, p50=5.1657, p75=9.3278, p90=12.2052),
        27: AgePercentile(p10=0.0453, p25=2.2934, p50=5.0717, p75=10.2629, p90=14.149),
        28: AgePercentile(p10=0.0, p25=1.7049, p50=5.4623, p75=10.6079, p90=15.9647),
        29: AgePercentile(p10=0.4107, p25=2.6749, p50=5.0377, p75=9.726, p90=13.6533),
        30: AgePercentile(p10=0.339, p25=2.8588, p50=6.3377, p75=11.6642, p90=15.7916),
        31: AgePercentile(p10=0.9862, p25=3.7765, p50=6.1461, p75=11.1273, p90=18.5287),
        32: AgePercentile(p10=1.6322, p25=4.8214, p50=7.8625, p75=12.8307, p90=18.1771),
        33: AgePercentile(p10=1.8566, p25=4.0473, p50=7.6473, p75=11.5688, p90=18.9282),
        34: AgePercentile(p10=1.2822, p25=3.8252, p50=8.1814, p75=12.0804, p90=17.5878),
        35: AgePercentile(p10=2.5309, p25=5.4218, p50=8.7373, p75=14.613, p90=23.9799),
        36: AgePercentile(p10=1.5381, p25=6.9512, p50=10.7532, p75=16.3822, p90=20.9379),
        37: AgePercentile(p10=2.5855, p25=5.5697, p50=11.9005, p75=17.0709, p90=20.8612),
        38: AgePercentile(p10=2.7152, p25=6.146, p50=10.2737, p75=17.8867, p90=20.2374),
    },
    "MHT": {
        17: AgePercentile(p10=11.7866, p25=14.8053, p50=18.8408, p75=23.4397, p90=25.7963),
        18: AgePercentile(p10=9.4637, p25=11.1336, p50=15.3745, p75=20.4358, p90=23.5955),
        19: AgePercentile(p10=6.1429, p25=9.2971, p50=12.4985, p75=16.4578, p90=20.9101),
        20: AgePercentile(p10=3.2283, p25=6.2904, p50=9.3169, p75=12.826, p90=18.1383),
        21: AgePercentile(p10=0.8148, p25=4.4636, p50=7.6677, p75=11.0115, p90=13.879),
        22: AgePercentile(p10=0.1533, p25=3.0723, p50=5.6106, p75=9.3777, p90=11.9204),
        23: AgePercentile(p10=0.9908, p25=2.96, p50=5.1686, p75=8.4486, p90=11.662),
        24: AgePercentile(p10=0.3013, p25=2.0231, p50=4.59, p75=7.0625, p90=9.5038),
        25: AgePercentile(p10=0.9357, p25=2.4062, p50=4.462, p75=6.7791, p90=10.369),
        26: AgePercentile(p10=0.5411, p25=1.6589, p50=3.4643, p75=6.3511, p90=9.9811),
        27: AgePercentile(p10=0.0, p25=0.9469, p50=2.7202, p75=5.555, p90=8.8584),
        28: AgePercentile(p10=0.0, p25=1.4638, p50=3.131, p75=6.0246, p90=8.364),
        29: AgePercentile(p10=0.3797, p25=1.8893, p50=3.9978, p75=6.4083, p90=8.878),
        30: AgePercentile(p10=0.8151, p25=2.2838, p50=4.0114, p75=7.5515, p90=9.8626),
        31: AgePercentile(p10=0.8633, p25=2.1633, p50=4.0594, p75=7.0483, p90=9.888),
        32: AgePercentile(p10=1.418, p25=3.5499, p50=5.4794, p75=7.9613, p90=12.8083),
        33: AgePercentile(p10=0.5081, p25=2.9419, p50=5.438, p75=8.4653, p90=12.4204),
        34: AgePercentile(p10=1.4699, p25=3.2014, p50=6.4749, p75=9.5888, p90=15.9402),
        35: AgePercentile(p10=1.8433, p25=4.2932, p50=5.8559, p75=8.6039, p90=13.614),
        36: AgePercentile(p10=2.5887, p25=4.9557, p50=6.4412, p75=10.6758, p90=14.7373),
        37: AgePercentile(p10=2.4083, p25=4.9465, p50=6.7642, p75=10.3984, p90=20.6821),
        38: AgePercentile(p10=2.292, p25=4.8135, p50=8.0268, p75=11.7997, p90=16.0541),
    },
    "FHT": {
        17: AgePercentile(p10=8.2662, p25=14.0833, p50=19.8534, p75=26.2498, p90=30.8167),
        18: AgePercentile(p10=6.5382, p25=11.0057, p50=17.1688, p75=23.3587, p90=27.6752),
        19: AgePercentile(p10=4.4463, p25=9.0047, p50=14.2116, p75=19.0419, p90=24.8105),
        20: AgePercentile(p10=3.7823, p25=6.5009, p50=11.4254, p75=16.2352, p90=21.9766),
        21: AgePercentile(p10=1.4879, p25=4.9432, p50=8.4975, p75=13.6654, p90=19.6177),
        22: AgePercentile(p10=0.8671, p25=3.5372, p50=6.5706, p75=10.4993, p90=14.2198),
        23: AgePercentile(p10=0.0, p25=2.5924, p50=4.9884, p75=8.9033, p90=12.3942),
        24: AgePercentile(p10=0.0, p25=2.1617, p50=4.8129, p75=8.1411, p90=12.8747),
        25: AgePercentile(p10=0.6477, p25=2.3583, p50=4.4524, p75=8.0242, p90=12.1211),
        26: AgePercentile(p10=0.0, p25=1.2835, p50=3.9405, p75=7.4597, p90=10.6655),
        27: AgePercentile(p10=0.0, p25=1.1372, p50=4.1086, p75=7.3009, p90=10.5245),
        28: AgePercentile(p10=0.0132, p25=1.6793, p50=4.5076, p75=7.6506, p90=11.9596),
        29: AgePercentile(p10=0.6663, p25=2.2337, p50=4.6027, p75=8.8129, p90=11.6478),
        30: AgePercentile(p10=0.7928, p25=2.6632, p50=5.2189, p75=9.0295, p90=13.1476),
        31: AgePercentile(p10=1.33, p25=2.2483, p50=4.0351, p75=9.4874, p90=12.3449),
        32: AgePercentile(p10=1.285, p25=3.3304, p50=6.3753, p75=9.7369, p90=16.6161),
        33: AgePercentile(p10=0.7021, p25=2.6019, p50=6.6919, p75=13.7917, p90=17.1308),
        34: AgePercentile(p10=1.6245, p25=2.8067, p50=6.5223, p75=11.983, p90=16.5625),
        35: AgePercentile(p10=2.2951, p25=4.7055, p50=8.2242, p75=13.9423, p90=17.8095),
        36: AgePercentile(p10=0.6335, p25=4.5235, p50=9.0714, p75=12.9763, p90=18.5891),
        37: AgePercentile(p10=2.7, p25=4.2339, p50=9.9821, p75=15.2924, p90=22.3261),
        38: AgePercentile(p10=3.5307, p25=9.3027, p50=11.9274, p75=15.5723, p90=23.6934),
    },
    "MSP": {
        17: AgePercentile(p10=11.0473, p25=14.7463, p50=17.8817, p75=23.338, p90=28.8308),
        18: AgePercentile(p10=6.5893, p25=10.7732, p50=15.8678, p75=22.4316, p90=27.0311),
        19: AgePercentile(p10=4.6072, p25=8.0454, p50=12.7329, p75=18.5209, p90=22.7101),
        20: AgePercentile(p10=1.2396, p25=5.2056, p50=9.8477, p75=14.8085, p90=18.8094),
        21: AgePercentile(p10=0.9904, p25=3.8631, p50=7.985, p75=12.4916, p90=16.514),
        22: AgePercentile(p10=0.2933, p25=3.1188, p50=6.2318, p75=9.6427, p90=12.5635),
        23: AgePercentile(p10=0.3902, p25=2.4817, p50=5.5739, p75=8.2072, p90=12.0234),
        24: AgePercentile(p10=0.0477, p25=2.2263, p50=4.6606, p75=7.9169, p90=11.5804),
        25: AgePercentile(p10=0.4916, p25=2.2996, p50=4.5852, p75=7.2919, p90=9.9471),
        26: AgePercentile(p10=0.0, p25=1.2798, p50=3.7266, p75=6.3942, p90=9.0781),
        27: AgePercentile(p10=0.0, p25=1.3532, p50=3.3498, p75=5.5967, p90=8.6282),
        28: AgePercentile(p10=0.0, p25=1.5363, p50=3.6269, p75=6.9321, p90=10.0747),
        29: AgePercentile(p10=0.1018, p25=1.5324, p50=3.8556, p75=6.696, p90=9.7173),
        30: AgePercentile(p10=0.3664, p25=2.2668, p50=4.4655, p75=7.8605, p90=11.4178),
        31: AgePercentile(p10=0.8712, p25=2.1954, p50=4.6202, p75=8.8608, p90=13.7158),
        32: AgePercentile(p10=1.0557, p25=2.2738, p50=4.5993, p75=8.424, p90=13.2486),
        33: AgePercentile(p10=0.9686, p25=3.6597, p50=5.7005, p75=9.0393, p90=16.614),
        34: AgePercentile(p10=1.6137, p25=3.1276, p50=5.6492, p75=9.2214, p90=13.3114),
        35: AgePercentile(p10=1.8658, p25=4.5152, p50=7.4849, p75=12.2962, p90=15.7895),
        36: AgePercentile(p10=1.9685, p25=4.1359, p50=8.1131, p75=14.5011, p90=19.9309),
        37: AgePercentile(p10=0.415, p25=2.373, p50=9.1456, p75=14.1447, p90=20.3556),
        38: AgePercentile(p10=1.2349, p25=4.7534, p50=7.8447, p75=12.7974, p90=24.4799),
    },
    "FSP": {
        17: AgePercentile(p10=4.4919, p25=10.5498, p50=17.2978, p75=23.1485, p90=30.3473),
        18: AgePercentile(p10=3.7581, p25=8.1237, p50=14.3573, p75=18.741, p90=22.6748),
        19: AgePercentile(p10=1.4261, p25=5.6769, p50=11.0065, p75=16.4959, p90=21.6049),
        20: AgePercentile(p10=0.4656, p25=3.7458, p50=9.3558, p75=13.8567, p90=18.3857),
        21: AgePercentile(p10=0.0, p25=3.8873, p50=8.0133, p75=12.0619, p90=17.3703),
        22: AgePercentile(p10=0.6635, p25=2.8271, p50=5.952, p75=9.7116, p90=13.4141),
        23: AgePercentile(p10=0.2426, p25=2.1691, p50=5.0836, p75=8.6563, p90=11.7316),
        24: AgePercentile(p10=0.0, p25=1.8794, p50=4.119, p75=7.9007, p90=12.4074),
        25: AgePercentile(p10=0.0, p25=1.7617, p50=4.7481, p75=8.3988, p90=11.7472),
        26: AgePercentile(p10=0.0482, p25=1.7056, p50=4.5738, p75=7.7855, p90=12.106),
        27: AgePercentile(p10=0.0, p25=2.2848, p50=4.3315, p75=7.4408, p90=11.4902),
        28: AgePercentile(p10=0.3742, p25=2.2002, p50=5.0214, p75=8.1796, p90=12.3165),
        29: AgePercentile(p10=0.4568, p25=1.9149, p50=4.7265, p75=8.2143, p90=12.4206),
        30: AgePercentile(p10=0.288, p25=2.769, p50=4.9281, p75=7.9748, p90=11.5455),
        31: AgePercentile(p10=0.0, p25=1.8974, p50=5.536, p75=9.1996, p90=12.01),
        32: AgePercentile(p10=1.5454, p25=3.2795, p50=6.409, p75=10.5913, p90=13.1188),
        33: AgePercentile(p10=0.2386, p25=3.5488, p50=6.9772, p75=11.3122, p90=15.8868),
        34: AgePercentile(p10=2.0612, p25=4.5527, p50=8.524, p75=12.8052, p90=15.1521),
        35: AgePercentile(p10=1.685, p25=4.2596, p50=7.9923, p75=11.6272, p90=17.8206),
        36: AgePercentile(p10=1.0463, p25=4.134, p50=7.9922, p75=14.811, p90=19.3114),
        37: AgePercentile(p10=3.6998, p25=5.1145, p50=11.6228, p75=16.9902, p90=21.5765),
        38: AgePercentile(p10=3.5676, p25=6.2929, p50=8.9817, p75=14.8303, p90=22.7937),
    },
}


# ==============================================================================
# ROC THRESHOLDS
# ==============================================================================
# From ROC analysis of finalist classification. 80% sensitivity threshold is
# used as the primary threshold for athlete classification.

ROC_THRESHOLDS: Dict[str, ROCThreshold] = {
    "M100": ROCThreshold(
        optimal_threshold=10.15,
        threshold_90_sensitivity=10.35,
        threshold_80_sensitivity=10.21,
        threshold_70_sensitivity=10.05,
    ),
    "F100": ROCThreshold(
        optimal_threshold=11.50,
        threshold_90_sensitivity=11.68,
        threshold_80_sensitivity=11.42,
        threshold_70_sensitivity=11.22,
    ),
    "M200": ROCThreshold(
        optimal_threshold=20.62,
        threshold_90_sensitivity=20.85,
        threshold_80_sensitivity=20.68,
        threshold_70_sensitivity=20.48,
    ),
    "F200": ROCThreshold(
        optimal_threshold=23.55,
        threshold_90_sensitivity=23.78,
        threshold_80_sensitivity=23.48,
        threshold_70_sensitivity=23.25,
    ),
    "M400": ROCThreshold(
        optimal_threshold=44.64,
        threshold_90_sensitivity=44.94,
        threshold_80_sensitivity=44.72,
        threshold_70_sensitivity=44.48,
    ),
    "F400": ROCThreshold(
        optimal_threshold=52.65,
        threshold_90_sensitivity=52.95,
        threshold_80_sensitivity=52.54,
        threshold_70_sensitivity=52.15,
    ),
    "F100H": ROCThreshold(
        optimal_threshold=13.28,
        threshold_90_sensitivity=13.42,
        threshold_80_sensitivity=13.20,
        threshold_70_sensitivity=13.05,
    ),
    "M110H": ROCThreshold(
        optimal_threshold=13.80,
        threshold_90_sensitivity=13.98,
        threshold_80_sensitivity=13.89,
        threshold_70_sensitivity=13.78,
    ),
    "M400H": ROCThreshold(
        optimal_threshold=48.17,
        threshold_90_sensitivity=48.58,
        threshold_80_sensitivity=48.30,
        threshold_70_sensitivity=48.07,
    ),
    "F400H": ROCThreshold(
        optimal_threshold=57.70,
        threshold_90_sensitivity=57.95,
        threshold_80_sensitivity=57.58,
        threshold_70_sensitivity=57.25,
    ),
    "MDT": ROCThreshold(optimal_threshold=66.03, threshold_90_sensitivity=33.96, threshold_80_sensitivity=33.96, threshold_70_sensitivity=33.96),
    "FDT": ROCThreshold(optimal_threshold=63.97, threshold_90_sensitivity=16.98, threshold_80_sensitivity=16.98, threshold_70_sensitivity=16.98),
    "MJT": ROCThreshold(optimal_threshold=86.31, threshold_90_sensitivity=35.58, threshold_80_sensitivity=35.58, threshold_70_sensitivity=35.58),
    "FJT": ROCThreshold(optimal_threshold=63.43, threshold_90_sensitivity=24.25, threshold_80_sensitivity=24.25, threshold_70_sensitivity=24.25),
    "MHT": ROCThreshold(optimal_threshold=78.44, threshold_90_sensitivity=21.12, threshold_80_sensitivity=21.12, threshold_70_sensitivity=21.12),
    "FHT": ROCThreshold(optimal_threshold=74.03, threshold_90_sensitivity=23.22, threshold_80_sensitivity=23.22, threshold_70_sensitivity=23.22),
    "MSP": ROCThreshold(optimal_threshold=20.68, threshold_90_sensitivity=11.44, threshold_80_sensitivity=11.44, threshold_70_sensitivity=11.44),
    "FSP": ROCThreshold(optimal_threshold=18.75, threshold_90_sensitivity=8.67, threshold_80_sensitivity=8.67, threshold_70_sensitivity=8.67),
}


# ==============================================================================
# TRAJECTORY CLUSTERS (K=3)
# ==============================================================================
# Three cluster centroids representing typical career trajectory patterns.
# Values are % off PB at ages 18, 20, 22, 24, 26, 28.

TRAJECTORY_CENTROIDS: Dict[str, List[TrajectoryCluster]] = {
    "M100": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[4.2, 2.5, 1.8, 1.6, 2.8, 3.8],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[8.0, 5.2, 3.5, 2.0, 1.9, 3.2],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[5.5, 3.8, 2.5, 2.2, 2.8, 3.5],
        ),
    ],
    "F100": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[5.2, 3.0, 2.0, 1.8, 3.2, 4.5],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[9.5, 6.2, 4.0, 2.2, 2.2, 3.8],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[6.5, 4.5, 3.0, 2.5, 3.2, 4.2],
        ),
    ],
    "M200": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[4.8, 2.8, 1.9, 1.5, 2.5, 3.5],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[8.5, 5.5, 3.8, 2.0, 1.8, 3.0],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[6.0, 4.0, 2.8, 2.2, 2.8, 3.8],
        ),
    ],
    "F200": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[5.8, 3.2, 2.1, 1.9, 3.0, 4.2],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[10.0, 6.8, 4.5, 2.2, 2.0, 3.5],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[7.0, 4.8, 3.2, 2.5, 3.0, 4.0],
        ),
    ],
    "M400": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[4.7, 3.8, 3.8, 6.0, 6.5, 11.8],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[5.8, 3.3, 2.9, 3.0, 3.6, 4.8],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[13.3, 5.2, 2.8, 3.2, 3.9, 4.3],
        ),
    ],
    "F400": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[6.5, 3.8, 2.3, 1.9, 3.2, 4.5],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[10.5, 7.0, 4.8, 2.3, 2.0, 3.8],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[7.5, 5.2, 3.5, 2.8, 3.2, 4.5],
        ),
    ],
    "F100H": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[5.5, 3.2, 2.0, 1.8, 3.0, 4.2],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[9.8, 6.5, 4.2, 2.0, 2.0, 3.5],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[7.0, 4.8, 3.2, 2.5, 3.0, 4.2],
        ),
    ],
    "M110H": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[5.0, 2.9, 1.9, 1.5, 2.6, 3.6],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[9.0, 5.8, 3.8, 2.0, 1.9, 3.2],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[6.8, 4.2, 2.8, 2.2, 2.9, 3.8],
        ),
    ],
    "M400H": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[5.1, 3.5, 2.9, 3.2, 4.3, 6.1],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[6.8, 4.2, 3.0, 5.3, 5.0, 14.6],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[8.4, 5.1, 3.4, 2.7, 3.2, 3.6],
        ),
    ],
    "F400H": [
        TrajectoryCluster(
            name="Early Peaker",
            description="Achieves peak performance in early-to-mid 20s, then shows age-related decline.",
            pct_off_pb=[7.0, 4.0, 2.4, 1.9, 3.5, 4.8],
        ),
        TrajectoryCluster(
            name="Late Developer",
            description="Steady improvement through late 20s, peaks in mid-to-late 20s.",
            pct_off_pb=[11.0, 7.2, 5.0, 2.4, 2.2, 4.0],
        ),
        TrajectoryCluster(
            name="Plateau Pattern",
            description="Reaches competitive level early, maintains consistent performance.",
            pct_off_pb=[8.0, 5.5, 3.8, 3.0, 3.5, 4.8],
        ),
    ],
    "MDT": [
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[22.9123, 18.3572, 13.2367, 9.337, 6.5155, 5.7511]),
        TrajectoryCluster(name="Consistent Performer", description="Consistent Performer trajectory pattern", pct_off_pb=[7.1728, 5.5917, 6.1675, 7.115, 8.4418, 9.282]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[16.3803, 10.7168, 6.057, 4.0592, 3.3542, 3.526]),
    ],
    "FDT": [
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[23.4465, 19.3378, 13.8909, 10.4168, 8.3278, 7.1466]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[18.7705, 10.1501, 6.4532, 3.6526, 2.3763, 2.8229]),
        TrajectoryCluster(name="Consistent Performer", description="Consistent Performer trajectory pattern", pct_off_pb=[7.4213, 5.4865, 5.294, 5.6003, 6.89, 7.3194]),
    ],
    "MJT": [
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[21.4047, 15.304, 10.2816, 6.7113, 6.3817, 7.4965]),
        TrajectoryCluster(name="Prime Peaker", description="Prime Peaker trajectory pattern", pct_off_pb=[8.5186, 4.6245, 4.1208, 5.9655, 10.3211, 15.4544]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[12.0808, 8.274, 6.2282, 4.2076, 3.4426, 4.0987]),
    ],
    "FJT": [
        TrajectoryCluster(name="Prime Peaker", description="Prime Peaker trajectory pattern", pct_off_pb=[8.0673, 5.4463, 5.5107, 5.049, 10.5852, 14.1837]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[24.6679, 19.7134, 17.2064, 10.5085, 7.8328, 6.1448]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[12.981, 9.3317, 6.2288, 4.8071, 3.268, 3.3675]),
    ],
    "MHT": [
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[21.651, 15.5621, 8.5993, 6.095, 3.2328, 3.7299]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[11.1431, 10.4465, 9.9928, 7.6975, 8.2812, 4.4549]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[11.1582, 7.1362, 3.783, 2.6781, 2.5553, 2.9568]),
    ],
    "FHT": [
        TrajectoryCluster(name="Prime Peaker", description="Prime Peaker trajectory pattern", pct_off_pb=[10.9408, 8.0609, 5.8221, 4.1883, 4.3512, 5.0429]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[22.9389, 15.3169, 8.5474, 5.6859, 3.9713, 4.2978]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[28.1039, 25.9455, 21.905, 12.9735, 8.3247, 5.5373]),
    ],
    "MSP": [
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[24.19, 19.3496, 12.9901, 8.3499, 4.2888, 3.9185]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[17.0037, 11.1643, 6.487, 3.6819, 3.6595, 3.2547]),
        TrajectoryCluster(name="Consistent Performer", description="Consistent Performer trajectory pattern", pct_off_pb=[8.0589, 5.6255, 3.9212, 5.5902, 6.07, 6.2931]),
    ],
    "FSP": [
        TrajectoryCluster(name="Prime Peaker", description="Prime Peaker trajectory pattern", pct_off_pb=[10.8197, 6.507, 4.3089, 3.7497, 4.5404, 4.7301]),
        TrajectoryCluster(name="Late Developer", description="Late Developer trajectory pattern", pct_off_pb=[21.6947, 16.3422, 10.8147, 6.4363, 4.7693, 4.7638]),
        TrajectoryCluster(name="Consistent Performer", description="Consistent Performer trajectory pattern", pct_off_pb=[13.3509, 11.4304, 13.2382, 15.867, 17.0571, 16.14]),
    ],
}


# ==============================================================================
# LOGISTIC REGRESSION COEFFICIENTS
# ==============================================================================
# Standardized coefficients for finalist prediction model.

MODEL_COEFFICIENTS = ModelCoefficient(
    best_18_20_z=-1.303,
    pct_rank_at_20=-0.245,
    improvement_y0_y2_z=0.060,
    consistency_std_z=0.032,
    races_18_20=-0.055,
    intercept=0.0,
)

# Throws-specific model coefficients (trained on throws data)
THROWS_MODEL_COEFFICIENTS = ModelCoefficient(
    best_18_20_z=1.559739,
    pct_rank_at_20=0.875296,
    improvement_y0_y2_z=0.082062,
    consistency_std_z=-0.052381,
    races_18_20=0.034823,
    intercept=-1.830214,
)



# ==============================================================================
# IMPROVEMENT NORMS
# ==============================================================================
# Median expected improvement from age 18-19 to personal best (PB) for
# finalists vs non-finalists.

IMPROVEMENT_NORMS: Dict[str, ImprovementNorm] = {
    "M100": ImprovementNorm(
        finalist_median_pct=3.2,
        finalist_std_pct=1.8,
        non_finalist_median_pct=1.5,
        non_finalist_std_pct=1.2,
    ),
    "F100": ImprovementNorm(
        finalist_median_pct=4.0,
        finalist_std_pct=2.0,
        non_finalist_median_pct=1.8,
        non_finalist_std_pct=1.4,
    ),
    "M200": ImprovementNorm(
        finalist_median_pct=3.5,
        finalist_std_pct=1.9,
        non_finalist_median_pct=1.6,
        non_finalist_std_pct=1.2,
    ),
    "F200": ImprovementNorm(
        finalist_median_pct=4.2,
        finalist_std_pct=2.1,
        non_finalist_median_pct=1.9,
        non_finalist_std_pct=1.4,
    ),
    "M400": ImprovementNorm(
        finalist_median_pct=3.9,
        finalist_std_pct=1.3,
        non_finalist_median_pct=3.3,
        non_finalist_std_pct=1.8,
    ),
    "F400": ImprovementNorm(
        finalist_median_pct=4.5,
        finalist_std_pct=2.2,
        non_finalist_median_pct=2.0,
        non_finalist_std_pct=1.5,
    ),
    "F100H": ImprovementNorm(
        finalist_median_pct=4.2,
        finalist_std_pct=2.0,
        non_finalist_median_pct=1.9,
        non_finalist_std_pct=1.4,
    ),
    "M110H": ImprovementNorm(
        finalist_median_pct=3.8,
        finalist_std_pct=2.0,
        non_finalist_median_pct=1.7,
        non_finalist_std_pct=1.3,
    ),
    "M400H": ImprovementNorm(
        finalist_median_pct=4.0,
        finalist_std_pct=2.4,
        non_finalist_median_pct=3.8,
        non_finalist_std_pct=1.6,
    ),
    "F400H": ImprovementNorm(
        finalist_median_pct=4.8,
        finalist_std_pct=2.3,
        non_finalist_median_pct=2.1,
        non_finalist_std_pct=1.5,
    ),
    "MDT": ImprovementNorm(finalist_median_pct=15.516, finalist_std_pct=8.089, non_finalist_median_pct=10.921, non_finalist_std_pct=11.184),
    "FDT": ImprovementNorm(finalist_median_pct=16.985, finalist_std_pct=9.709, non_finalist_median_pct=9.44, non_finalist_std_pct=11.142),
    "MJT": ImprovementNorm(finalist_median_pct=15.396, finalist_std_pct=9.34, non_finalist_median_pct=12.134, non_finalist_std_pct=8.425),
    "FJT": ImprovementNorm(finalist_median_pct=17.963, finalist_std_pct=9.556, non_finalist_median_pct=9.577, non_finalist_std_pct=9.467),
    "MHT": ImprovementNorm(finalist_median_pct=14.451, finalist_std_pct=8.713, non_finalist_median_pct=12.118, non_finalist_std_pct=7.864),
    "FHT": ImprovementNorm(finalist_median_pct=12.993, finalist_std_pct=9.103, non_finalist_median_pct=13.831, non_finalist_std_pct=14.787),
    "MSP": ImprovementNorm(finalist_median_pct=16.194, finalist_std_pct=9.994, non_finalist_median_pct=10.533, non_finalist_std_pct=9.494),
    "FSP": ImprovementNorm(finalist_median_pct=15.096, finalist_std_pct=8.266, non_finalist_median_pct=9.046, non_finalist_std_pct=9.828),
}


# ==============================================================================
# MODEL CALIBRATION (Z-SCORE NORMALIZATION)
# ==============================================================================
# Mean and standard deviation for each event+gender for z-score normalization.

MODEL_CALIBRATION: Dict[str, ModelCalibration] = {
    "M100": ModelCalibration(mean_time=10.45, std_time=0.27),
    "F100": ModelCalibration(mean_time=11.65, std_time=0.38),
    "M200": ModelCalibration(mean_time=21.05, std_time=0.56),
    "F200": ModelCalibration(mean_time=23.75, std_time=0.78),
    "M400": ModelCalibration(mean_time=45.18, std_time=1.30),
    "F400": ModelCalibration(mean_time=53.60, std_time=2.10),
    "F100H": ModelCalibration(mean_time=13.55, std_time=0.55),
    "M110H": ModelCalibration(mean_time=13.85, std_time=0.35),
    "M400H": ModelCalibration(mean_time=48.67, std_time=1.16),
    "F400H": ModelCalibration(mean_time=58.20, std_time=2.30),
    "MDT": ModelCalibration(mean_time=59.794, std_time=8.699),
    "FDT": ModelCalibration(mean_time=55.148, std_time=10.8),
    "MJT": ModelCalibration(mean_time=80.2, std_time=12.919),
    "FJT": ModelCalibration(mean_time=58.117, std_time=11.099),
    "MHT": ModelCalibration(mean_time=72.366, std_time=13.486),
    "FHT": ModelCalibration(mean_time=65.618, std_time=11.867),
    "MSP": ModelCalibration(mean_time=18.827, std_time=2.764),
    "FSP": ModelCalibration(mean_time=16.226, std_time=2.932),
}


# ==============================================================================
# VALID DISCIPLINES AND GENDERS
# ==============================================================================

VALID_DISCIPLINES = ["100m", "200m", "400m", "100mH", "110mH", "400mH", "Discus Throw", "Javelin Throw", "Hammer Throw", "Shot Put"]
VALID_GENDERS = ["M", "F"]

# Throws events use distance (meters) instead of time (seconds)
# Higher values are better for throws (direction = 'descending')
THROWS_EVENTS = {"MDT", "FDT", "MJT", "FJT", "MHT", "FHT", "MSP", "FSP"}
THROWS_DISCIPLINES = ["Discus Throw", "Javelin Throw", "Hammer Throw", "Shot Put"]

def is_throws_event(event_code: str) -> bool:
    """Check if an event code is a throws discipline."""
    return event_code in THROWS_EVENTS


# Mapping from user-friendly discipline names to internal codes
DISCIPLINE_MAPPING = {
    "100m": "M100" if None else "F100",  # Will be determined by gender
    "200m": "M200" if None else "F200",
    "400m": "M400" if None else "F400",  # Will be determined by gender
    "100mH": "F100H",  # Women only
    "110mH": "M110H",  # Men only
    "400mH": "M400H" if None else "F400H",  # Will be determined by gender
    "Discus Throw": "MDT",  # Will be prefixed with gender
    "Javelin Throw": "MJT",
    "Hammer Throw": "MHT",
    "Shot Put": "MSP",
}


def get_event_code(discipline: str, gender: str) -> str:
    """
    Convert discipline name and gender to internal event code.

    Args:
        discipline: Event name (e.g., "100m", "110mH")
        gender: "M" or "F"

    Returns:
        Internal event code (e.g., "M100", "F100H")

    Raises:
        ValueError: If discipline or gender is invalid
    """
    if discipline not in VALID_DISCIPLINES:
        raise ValueError(f"Invalid discipline: {discipline}")
    if gender not in VALID_GENDERS:
        raise ValueError(f"Invalid gender: {gender}")

    # Build event code
    if discipline == "100m":
        return f"{gender}100"
    elif discipline == "200m":
        return f"{gender}200"
    elif discipline == "400m":
        return f"{gender}400"
    elif discipline == "100mH":
        return "F100H"
    elif discipline == "110mH":
        return "M110H"
    elif discipline == "400mH":
        return f"{gender}400H"
    elif discipline == "Discus Throw":
        return f"{gender}DT"
    elif discipline == "Javelin Throw":
        return f"{gender}JT"
    elif discipline == "Hammer Throw":
        return f"{gender}HT"
    elif discipline == "Shot Put":
        return f"{gender}SP"
    else:
        raise ValueError(f"Unknown discipline: {discipline}")
