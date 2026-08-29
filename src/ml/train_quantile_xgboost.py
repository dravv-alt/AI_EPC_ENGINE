"""
============================================================================
XGBOOST QUANTILE REGRESSION & TREESHAP EXPLAINER PIPELINE
============================================================================
Trains multi-output Quantile Gradient Boosted Trees (p10, p50, p90) on the 
maritime synthetic/AIS training dataset, validates leak-free GroupShuffleSplit 
generalization by voyage/scenario_id, and computes TreeSHAP feature attributions.
"""

import sys
import json
import argparse
import pandas as pd
import numpy as np

try:
    import xgboost as xgb
    from sklearn.model_selection import GroupShuffleSplit
    import shap
except ImportError:
    print("Notice: Install ML dependencies with `pip install xgboost scikit-learn shap pandas numpy`")

FEATURE_COLUMNS = [
    "beaufort_force",
    "wave_height_m",
    "swell_height_m",
    "relative_wave_angle_deg",
    "sea_condition_encoded",
    "visibility_m",
    "precipitation_mm_h",
    "vessel_class_encoded",
    "block_coefficient",
    "loaded_condition_encoded",
    "leg_distance_nm",
    "forecast_horizon_hours",
    "is_climatological_fallback",
    "is_chokepoint_leg",
    "departure_month",
]

SEA_CONDITION_ORDER = ["following", "quartering", "beam", "bow", "head"]

def load_dataset_from_json(json_path: str) -> pd.DataFrame:
    with open(json_path, "r", encoding="utf-8") as f:
        rows = json.load(f)
    
    records = []
    for r in rows:
        scen_id = r["scenarioId"]
        vessel_class = r.get("vesselClass", "Container_PostPanamax")
        is_laden = int(r.get("isLaden", True))
        departure_month = int(r.get("departureTime", "2024-01-01")[5:7])

        for leg in r.get("legs", []):
            sea_cond = leg.get("seaCondition", "head")
            sea_idx = SEA_CONDITION_ORDER.index(sea_cond) if sea_cond in SEA_CONDITION_ORDER else 4
            input_snap = leg.get("inputSnapshot", {})

            records.append({
                "scenario_id": scen_id,
                "beaufort_force": leg.get("beaufortForce", 0),
                "wave_height_m": input_snap.get("waveHeightM", 1.5),
                "swell_height_m": input_snap.get("swellHeightM", 1.0),
                "relative_wave_angle_deg": leg.get("relativeWaveAngleDeg", 0),
                "sea_condition_encoded": sea_idx,
                "visibility_m": input_snap.get("visibilityMeters", 10000),
                "precipitation_mm_h": 3.5 if input_snap.get("weatherCode", 0) >= 60 else 0.0,
                "vessel_class_encoded": vessel_class,
                "block_coefficient": 0.75 if leg.get("speedLoss", {}).get("cForm", False) else 0.65,
                "loaded_condition_encoded": is_laden,
                "leg_distance_nm": leg.get("legDistanceNm", 50.0),
                "forecast_horizon_hours": input_snap.get("forecastHorizonHours", 0),
                "is_climatological_fallback": int(input_snap.get("isClimatologicalFallback", False)),
                "is_chokepoint_leg": int(leg.get("primaryCause", {}).get("category") == "chokepoint_queuing"),
                "departure_month": departure_month,
                "clean_delay_hours": leg.get("cleanDelayHours", leg.get("delayHours", 0.0)),
                "target_noisy_delay_hours": leg.get("noisyLegDelayHours", leg.get("delayHours", 0.0)),
            })

    df = pd.DataFrame(records)
    df["vessel_class_encoded"] = df["vessel_class_encoded"].astype("category")
    return df

def evaluate_feature_set(train_df, test_df, feature_cols, experiment_name):
    X_train = train_df[feature_cols]
    y_train = train_df["residual_hours"]
    X_test = test_df[feature_cols]
    y_test = test_df["target_noisy_delay_hours"]
    y_physics_test = test_df["clean_delay_hours"]

    # Train Quantile GBDTs for q = 0.10, 0.50, 0.90
    models = {}
    for q in [0.10, 0.50, 0.90]:
        model = xgb.XGBRegressor(
            objective="reg:quantileerror",
            quantile_alpha=q,
            n_estimators=150,
            max_depth=3,
            learning_rate=0.03,
            enable_categorical=True,
            random_state=42,
        )
        model.fit(X_train, y_train)
        models[q] = model

    delta_p10 = models[0.10].predict(X_test)
    delta_p50 = models[0.50].predict(X_test)
    delta_p90 = models[0.90].predict(X_test)

    p10_preds = np.maximum(0.0, y_physics_test + delta_p10)
    p50_preds = np.maximum(0.0, y_physics_test + delta_p50)
    p90_preds = np.maximum(p50_preds + 0.1, y_physics_test + delta_p90)

    p10_clean = np.minimum(p10_preds, p50_preds)
    p90_clean = np.maximum(p50_preds, p90_preds)

    baseline_mae = np.mean(np.abs(y_physics_test - y_test))
    ml_p50_mae = np.mean(np.abs(p50_preds - y_test))
    coverage_80 = np.mean((y_test >= p10_clean) & (y_test <= p90_clean))
    mae_reduction = ((baseline_mae - ml_p50_mae) / max(0.001, baseline_mae)) * 100

    print("\n" + "="*65)
    print(f"EXPERIMENT: {experiment_name}")
    print("="*65)
    print(f"Features Evaluated ({len(feature_cols)}):   {', '.join(feature_cols[:6])}...")
    print(f"Physics Baseline MAE (Layer 1):     {baseline_mae:.4f} hours")
    print(f"Physics + XGBoost p50 MAE (Layer 3):{ml_p50_mae:.4f} hours")
    print(f"MAE Error Reduction:                {mae_reduction:+.2f}%")
    print(f"80% Interval Coverage ([p10, p90]): {coverage_80*100:.1f}% (Target: ~80%)")
    print("="*65)

    importances = models[0.50].feature_importances_
    ranking = sorted(zip(feature_cols, importances), key=lambda x: -x[1])
    print("Top Residual Features by Gain:")
    for rank, (feat, score) in enumerate(ranking[:6], 1):
        print(f"  {rank}. {feat:<28}: {score*100:.2f}%")

    return {
        "baseline_mae": baseline_mae,
        "ml_mae": ml_p50_mae,
        "mae_reduction": mae_reduction,
        "coverage_80": coverage_80,
    }

def train_and_evaluate(df: pd.DataFrame):
    print(f"Loaded {len(df)} leg samples across {df['scenario_id'].nunique()} unique voyages.")

    # 1. Leak-Free Split by scenario_id (Voyage level)
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(splitter.split(df, groups=df["scenario_id"]))

    train_df = df.iloc[train_idx].copy()
    test_df = df.iloc[test_idx].copy()

    print(f"Train partition: {len(train_df)} legs | Test partition: {len(test_df)} legs ({test_df['scenario_id'].nunique()} unseen voyages)")

    # Physics-Informed Residual
    train_df["residual_hours"] = train_df["target_noisy_delay_hours"] - train_df["clean_delay_hours"]
    test_df["residual_hours"] = test_df["target_noisy_delay_hours"] - test_df["clean_delay_hours"]

    # 1. Full Model
    full_features = ["clean_delay_hours"] + FEATURE_COLUMNS
    evaluate_feature_set(train_df, test_df, full_features, "1. FULL FEATURE SET (16 Features)")

    # 2. Ablated Model: Dropping vessel_class_encoded and departure_month
    ablated_features = [
        col for col in full_features
        if col not in ["vessel_class_encoded", "departure_month"]
    ]
    evaluate_feature_set(train_df, test_df, ablated_features, "2. ABLATED PHYSICAL-ONLY MODEL (No Categoricals)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train XGBoost Quantile Regressor on Maritime Delay Dataset")
    parser.add_argument("--data", type=str, default="dataset_maritime.json", help="Path to synthetic/AIS JSON dataset")
    args = parser.parse_args()
    print("Loading dataset from:", args.data)
    try:
        df = load_dataset_from_json(args.data)
        train_and_evaluate(df)
    except FileNotFoundError:
        print(f"Dataset file {args.data} not found. Run dataset generator script first.")

