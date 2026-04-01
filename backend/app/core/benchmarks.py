"""
Benchmark reference data for Olympic-level athletes (2000-2024).

Contains age-performance percentiles, ROC thresholds, trajectory centroids,
logistic regression coefficients, and improvement norms across 6 disciplines.
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
}


# ==============================================================================
# VALID DISCIPLINES AND GENDERS
# ==============================================================================

VALID_DISCIPLINES = ["100m", "200m", "400m", "100mH", "110mH", "400mH"]
VALID_GENDERS = ["M", "F"]

# Mapping from user-friendly discipline names to internal codes
DISCIPLINE_MAPPING = {
    "100m": "M100" if None else "F100",  # Will be determined by gender
    "200m": "M200" if None else "F200",
    "400m": "M400" if None else "F400",  # Will be determined by gender
    "100mH": "F100H",  # Women only
    "110mH": "M110H",  # Men only
    "400mH": "M400H" if None else "F400H",  # Will be determined by gender
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
    else:
        raise ValueError(f"Unknown discipline: {discipline}")
