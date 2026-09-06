import os
import json
import pickle
import logging
import warnings
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import shap

# Suppress scikit-learn warnings about feature names during prediction
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

logger = logging.getLogger("ml_service.predictor")

# Global instances
_scaler = None
_model = None
_columns_list = None
_explainer = None
_X_train_scaled = None
_is_initialized = False

def init_model(dataset_path=None, model_path=None, columns_path=None):
    """
    Loads saved model artifacts, loads reference dataset, fits standard scaler,
    and initializes the SHAP LinearExplainer.
    """
    global _scaler, _model, _columns_list, _explainer, _X_train_scaled, _is_initialized
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    if columns_path is None:
        columns_path = os.path.join(current_dir, "model", "columns.json")
    if model_path is None:
        model_candidates = [
            os.path.join(current_dir, "model", "churn_model.pickle"),
            os.path.join(current_dir, "..", "model", "churn_model.pickle"),
        ]
        for candidate in model_candidates:
            if os.path.exists(candidate):
                model_path = candidate
                break
        else:
            model_path = model_candidates[0]
    if dataset_path is None:
        # Check workspace root first, then parent dirs
        dataset_candidates = [
            os.path.join(current_dir, "..", "customer_churn.csv"),
            os.path.join(current_dir, "customer_churn.csv"),
            os.path.join(os.getcwd(), "customer_churn.csv")
        ]
        for candidate in dataset_candidates:
            if os.path.exists(candidate):
                dataset_path = candidate
                break

    logger.info("Initializing ML Predictor and artifacts...")

    # 1. Load column definitions
    if not os.path.exists(columns_path):
        raise FileNotFoundError(f"Columns configuration file not found at: {columns_path}")
    with open(columns_path, "r") as f:
        _columns_list = json.load(f)["data_columns"]

    # 2. Load model
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model pickle file not found at: {model_path}")
    with open(model_path, "rb") as f:
        _model = pickle.load(f)

    # 3. Fit Scaler dynamically on reference dataset
    if not dataset_path or not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Reference dataset for scaling not found at: {dataset_path}")

    logger.info(f"Fitting StandardScaler on reference dataset: {dataset_path}")
    df = pd.read_csv(dataset_path)
    drop_cols = [
        'Churn Reason', 'CustomerID', 'Lat Long', 'Latitude', 'Longitude', 
        'Count', 'Country', 'State', 'Churn Label', 'Churn Score', 'CLTV', 
        'City', 'Zip Code'
    ]
    df1 = df.drop(drop_cols, axis='columns', errors='ignore')
    df2 = df1.drop_duplicates()

    binary_cols = ['Senior Citizen', 'Partner', 'Dependents', 'Phone Service', 'Paperless Billing']
    for col in binary_cols:
        df2[col] = df2[col].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    df2['Gender'] = df2['Gender'].map({'Male': 1, 'Female': 0}).fillna(0).astype(int)

    multi_cols = [
        'Multiple Lines', 'Internet Service', 'Online Security', 'Online Backup',
        'Device Protection', 'Tech Support', 'Streaming TV', 'Streaming Movies',
        'Contract', 'Payment Method'
    ]
    df3 = pd.get_dummies(df2, columns=multi_cols, drop_first=True)
    df3 = df3[df3["Total Charges"].astype(str).str.strip() != ""]
    df3['Total Charges'] = pd.to_numeric(df3['Total Charges'])

    df3['Average Monthly Spending'] = df3['Total Charges'] / df3['Tenure Months'].replace(0, np.nan)
    df3['Average Monthly Spending'] = df3['Average Monthly Spending'].fillna(df3['Monthly Charges'])
    df3['Long-term Customer'] = (df3['Tenure Months'] > 24).astype(int)

    service_cols = [
        'Online Security_Yes', 'Online Backup_Yes', 'Device Protection_Yes',
        'Tech Support_Yes', 'Streaming TV_Yes', 'Streaming Movies_Yes'
    ]

    for col in df3.columns:
        if df3[col].dtype == bool:
            df3[col] = df3[col].astype(int)

    df3['Number of Services'] = df3[service_cols].sum(axis=1)

    X = df3.drop('Churn Value', axis=1)
    y = df3['Churn Value']
    X.columns = [col.lower() for col in X.columns]
    X = X[_columns_list]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    _scaler = StandardScaler()
    _X_train_scaled = _scaler.fit_transform(X_train)

    # 4. Initialize SHAP LinearExplainer
    logger.info("Initializing SHAP LinearExplainer...")
    _explainer = shap.LinearExplainer(_model, _X_train_scaled)

    _is_initialized = True
    logger.info("ML Predictor & SHAP Explainer initialized successfully.")
    return True

def get_columns():
    return _columns_list

def get_model():
    return _model

def get_scaler():
    return _scaler

def get_explainer():
    return _explainer

def is_ready():
    return _is_initialized and _model is not None and _scaler is not None

def preprocess_dict(data):
    """
    Transforms a single customer input dictionary into a 1-row DataFrame 
    matching the exact 33-feature columns.
    """
    raw_record = {}

    # Binary features
    raw_record["gender"] = 1 if str(data.get("gender", "")).lower() == "male" else 0
    raw_record["senior citizen"] = 1 if str(data.get("senior_citizen", "")).lower() in ("yes", "1", "true") else 0
    raw_record["partner"] = 1 if str(data.get("partner", "")).lower() in ("yes", "1", "true") else 0
    raw_record["dependents"] = 1 if str(data.get("dependents", "")).lower() in ("yes", "1", "true") else 0
    raw_record["phone service"] = 1 if str(data.get("phone_service", "")).lower() in ("yes", "1", "true") else 0
    raw_record["paperless billing"] = 1 if str(data.get("paperless_billing", "")).lower() in ("yes", "1", "true") else 0

    tenure = int(data.get("tenure_months", 0) or 0)
    monthly_charges = float(data.get("monthly_charges", 0.0) or 0.0)
    total_charges = float(data.get("total_charges", 0.0) or 0.0)

    raw_record["tenure months"] = tenure
    raw_record["monthly charges"] = monthly_charges
    raw_record["total charges"] = total_charges

    # One hot categoricals
    multiple_lines = str(data.get("multiple_lines", "No"))
    raw_record["multiple lines_no phone service"] = 1 if multiple_lines == "No phone service" else 0
    raw_record["multiple lines_yes"] = 1 if multiple_lines == "Yes" else 0

    internet_service = str(data.get("internet_service", "No"))
    raw_record["internet service_fiber optic"] = 1 if internet_service == "Fiber optic" else 0
    raw_record["internet service_no"] = 1 if internet_service == "No" else 0

    online_security = str(data.get("online_security", "No"))
    raw_record["online security_no internet service"] = 1 if online_security == "No internet service" else 0
    raw_record["online security_yes"] = 1 if online_security == "Yes" else 0

    online_backup = str(data.get("online_backup", "No"))
    raw_record["online backup_no internet service"] = 1 if online_backup == "No internet service" else 0
    raw_record["online backup_yes"] = 1 if online_backup == "Yes" else 0

    device_protection = str(data.get("device_protection", "No"))
    raw_record["device protection_no internet service"] = 1 if device_protection == "No internet service" else 0
    raw_record["device protection_yes"] = 1 if device_protection == "Yes" else 0

    tech_support = str(data.get("tech_support", "No"))
    raw_record["tech support_no internet service"] = 1 if tech_support == "No internet service" else 0
    raw_record["tech support_yes"] = 1 if tech_support == "Yes" else 0

    streaming_tv = str(data.get("streaming_tv", "No"))
    raw_record["streaming tv_no internet service"] = 1 if streaming_tv == "No internet service" else 0
    raw_record["streaming tv_yes"] = 1 if streaming_tv == "Yes" else 0

    streaming_movies = str(data.get("streaming_movies", "No"))
    raw_record["streaming movies_no internet service"] = 1 if streaming_movies == "No internet service" else 0
    raw_record["streaming movies_yes"] = 1 if streaming_movies == "Yes" else 0

    contract = str(data.get("contract", "Month-to-month"))
    raw_record["contract_one year"] = 1 if contract == "One year" else 0
    raw_record["contract_two year"] = 1 if contract == "Two year" else 0

    payment_method = str(data.get("payment_method", "Mailed check"))
    raw_record["payment method_credit card (automatic)"] = 1 if payment_method == "Credit card (automatic)" else 0
    raw_record["payment method_electronic check"] = 1 if payment_method == "Electronic check" else 0
    raw_record["payment method_mailed check"] = 1 if payment_method == "Mailed check" else 0

    # Feature engineering
    raw_record["average monthly spending"] = total_charges / tenure if tenure > 0 else monthly_charges
    raw_record["long-term customer"] = 1 if tenure > 24 else 0

    # Sum of active add-on services
    services_count = 0
    if online_security == "Yes": services_count += 1
    if online_backup == "Yes": services_count += 1
    if device_protection == "Yes": services_count += 1
    if tech_support == "Yes": services_count += 1
    if streaming_tv == "Yes": services_count += 1
    if streaming_movies == "Yes": services_count += 1
    raw_record["number of services"] = services_count

    df_row = pd.DataFrame([raw_record])
    return df_row[_columns_list]

def preprocess_batch_list(records):
    """
    Transforms a list of customer input dictionaries into a batch DataFrame.
    """
    rows = []
    for data in records:
        raw_record = {}
        raw_record["gender"] = 1 if str(data.get("gender", "")).lower() == "male" else 0
        raw_record["senior citizen"] = 1 if str(data.get("senior_citizen", "")).lower() in ("yes", "1", "true") else 0
        raw_record["partner"] = 1 if str(data.get("partner", "")).lower() in ("yes", "1", "true") else 0
        raw_record["dependents"] = 1 if str(data.get("dependents", "")).lower() in ("yes", "1", "true") else 0
        raw_record["phone service"] = 1 if str(data.get("phone_service", "")).lower() in ("yes", "1", "true") else 0
        raw_record["paperless billing"] = 1 if str(data.get("paperless_billing", "")).lower() in ("yes", "1", "true") else 0

        tenure = int(data.get("tenure_months", 0) or 0)
        monthly_charges = float(data.get("monthly_charges", 0.0) or 0.0)
        total_charges = float(data.get("total_charges", 0.0) or 0.0)

        raw_record["tenure months"] = tenure
        raw_record["monthly charges"] = monthly_charges
        raw_record["total charges"] = total_charges

        multiple_lines = str(data.get("multiple_lines", "No"))
        raw_record["multiple lines_no phone service"] = 1 if multiple_lines == "No phone service" else 0
        raw_record["multiple lines_yes"] = 1 if multiple_lines == "Yes" else 0

        internet_service = str(data.get("internet_service", "No"))
        raw_record["internet service_fiber optic"] = 1 if internet_service == "Fiber optic" else 0
        raw_record["internet service_no"] = 1 if internet_service == "No" else 0

        online_security = str(data.get("online_security", "No"))
        raw_record["online security_no internet service"] = 1 if online_security == "No internet service" else 0
        raw_record["online security_yes"] = 1 if online_security == "Yes" else 0

        online_backup = str(data.get("online_backup", "No"))
        raw_record["online backup_no internet service"] = 1 if online_backup == "No internet service" else 0
        raw_record["online backup_yes"] = 1 if online_backup == "Yes" else 0

        device_protection = str(data.get("device_protection", "No"))
        raw_record["device protection_no internet service"] = 1 if device_protection == "No internet service" else 0
        raw_record["device protection_yes"] = 1 if device_protection == "Yes" else 0

        tech_support = str(data.get("tech_support", "No"))
        raw_record["tech support_no internet service"] = 1 if tech_support == "No internet service" else 0
        raw_record["tech support_yes"] = 1 if tech_support == "Yes" else 0

        streaming_tv = str(data.get("streaming_tv", "No"))
        raw_record["streaming tv_no internet service"] = 1 if streaming_tv == "No internet service" else 0
        raw_record["streaming tv_yes"] = 1 if streaming_tv == "Yes" else 0

        streaming_movies = str(data.get("streaming_movies", "No"))
        raw_record["streaming movies_no internet service"] = 1 if streaming_movies == "No internet service" else 0
        raw_record["streaming movies_yes"] = 1 if streaming_movies == "Yes" else 0

        contract = str(data.get("contract", "Month-to-month"))
        raw_record["contract_one year"] = 1 if contract == "One year" else 0
        raw_record["contract_two year"] = 1 if contract == "Two year" else 0

        payment_method = str(data.get("payment_method", "Mailed check"))
        raw_record["payment method_credit card (automatic)"] = 1 if payment_method == "Credit card (automatic)" else 0
        raw_record["payment method_electronic check"] = 1 if payment_method == "Electronic check" else 0
        raw_record["payment method_mailed check"] = 1 if payment_method == "Mailed check" else 0

        raw_record["average monthly spending"] = total_charges / tenure if tenure > 0 else monthly_charges
        raw_record["long-term customer"] = 1 if tenure > 24 else 0

        services_count = 0
        if online_security == "Yes": services_count += 1
        if online_backup == "Yes": services_count += 1
        if device_protection == "Yes": services_count += 1
        if tech_support == "Yes": services_count += 1
        if streaming_tv == "Yes": services_count += 1
        if streaming_movies == "Yes": services_count += 1
        raw_record["number of services"] = services_count

        rows.append(raw_record)

    df_batch = pd.DataFrame(rows)
    return df_batch[_columns_list]
