import os
import json
import pickle
import logging
import warnings
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
# pyrefly: ignore [missing-import]
import shap

# Suppress scikit-learn warnings about feature names during prediction
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

logger = logging.getLogger(__name__)

# Global variables for model structures
_scaler = None
_model = None
_columns_list = None
_explainer = None
_X_train_scaled = None

def init_prediction_service():
    """Loads artifacts, reads dataset, fits standard scaler, and initializes SHAP explainer."""
    global _scaler, _model, _columns_list, _explainer, _X_train_scaled
    
    try:
        # Define paths dynamically relative to server directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        dataset_path = os.path.join(base_dir, "..", "customer_churn.csv")
        artifacts_dir = os.path.join(base_dir, "artifacts")
        model_path = os.path.join(artifacts_dir, "churn_model.pickle")
        columns_path = os.path.join(artifacts_dir, "columns.json")
        
        logger.info("Initializing Prediction Service...")
        
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
            
        # 3. Fit Scaler dynamically on raw dataset
        if not os.path.exists(dataset_path):
            raise FileNotFoundError(f"Original dataset for scaling not found at: {dataset_path}")
            
        logger.info("Fitting StandardScaler on original dataset...")
        df = pd.read_csv(dataset_path)
        df1 = df.drop(['Churn Reason', 'CustomerID', 'Lat Long', 'Latitude', 'Longitude', 'Count', 'Country', 'State', 'Churn Label', 'Churn Score', 'CLTV', 'City', 'Zip Code'], axis = 'columns', errors='ignore')
        df2 = df1.drop_duplicates()

        binary_cols = ['Senior Citizen', 'Partner', 'Dependents', 'Phone Service', 'Paperless Billing']
        for col in binary_cols:
            df2.loc[:, col] = df2[col].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
        df2.loc[:, 'Gender'] = df2['Gender'].map({'Male': 1, 'Female': 0}).fillna(0).astype(int)

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
        
        # Ensure dummy output fields are integer/binary
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
        
        # 4. Initialize SHAP Explainer
        # We cap training masker samples to 100 for fast explanation execution
        logger.info("Initializing SHAP LinearExplainer...")
        _explainer = shap.LinearExplainer(_model, _X_train_scaled)
        
        logger.info("Prediction Service initialized successfully.")
        return True
    except Exception as e:
        logger.exception(f"Error during initialization of prediction service: {e}")
        return False

def preprocess_input(data):
    """Maps a customer data dictionary to the exact 33 features expected by the model."""
    # Build raw record matching the columns format
    raw_record = {}
    
    # Map raw features
    raw_record["gender"] = 1 if str(data.get("gender", "")).lower() == "male" else 0
    raw_record["senior citizen"] = 1 if str(data.get("senior_citizen", "")).lower() in ("yes", "1", "true") else 0
    raw_record["partner"] = 1 if str(data.get("partner", "")).lower() in ("yes", "1", "true") else 0
    raw_record["dependents"] = 1 if str(data.get("dependents", "")).lower() in ("yes", "1", "true") else 0
    raw_record["phone service"] = 1 if str(data.get("phone_service", "")).lower() in ("yes", "1", "true") else 0
    raw_record["paperless billing"] = 1 if str(data.get("paperless_billing", "")).lower() in ("yes", "1", "true") else 0
    
    tenure = int(data.get("tenure_months", 0))
    monthly_charges = float(data.get("monthly_charges", 0.0))
    total_charges = float(data.get("total_charges", 0.0))
    
    raw_record["tenure months"] = tenure
    raw_record["monthly charges"] = monthly_charges
    raw_record["total charges"] = total_charges

    # One hot variables
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
    
    # Calculate sum of services
    services_count = 0
    if online_security == "Yes": services_count += 1
    if online_backup == "Yes": services_count += 1
    if device_protection == "Yes": services_count += 1
    if tech_support == "Yes": services_count += 1
    if streaming_tv == "Yes": services_count += 1
    if streaming_movies == "Yes": services_count += 1
    raw_record["number of services"] = services_count

    # Convert to standard format ordered exactly like columns.json
    df_row = pd.DataFrame([raw_record])
    df_row = df_row[_columns_list]
    return df_row

def generate_insights(data, top_features):
    """Generates natural language explanation and actionable recommendations based on SHAP values."""
    # Natural Language Explanation
    positive_factors = []
    negative_factors = []
    
    # Extract feature values for explanation
    tenure = int(data.get("tenure_months", 0))
    contract = str(data.get("contract", "Month-to-month"))
    internet = str(data.get("internet_service", "No"))
    dependents = str(data.get("dependents", "No"))
    tech_support = str(data.get("tech_support", "No"))
    monthly_charges = float(data.get("monthly_charges", 0.0))

    # Compile explanations based on feature contributions
    for item in top_features[:10]: # Check top 10 impactful features
        name = item["feature"].lower()
        impact = item["impact"]
        
        if impact > 0: # Increases churn risk
            if "tenure" in name and tenure < 12:
                positive_factors.append("Short tenure period (less than a year)")
            elif "contract" in name and contract == "Month-to-month":
                positive_factors.append("Flexible month-to-month billing without a long-term commitment")
            elif "fiber optic" in name and internet == "Fiber optic":
                positive_factors.append("Subscribing to premium Fiber Optic internet service")
            elif "monthly charges" in name and monthly_charges > 70:
                positive_factors.append(f"High monthly service billing of ${monthly_charges:.2f}")
            elif "tech support" in name and tech_support == "No":
                positive_factors.append("Lack of dedicated customer tech support subscription")
        else: # Decreases churn risk
            if "tenure" in name and tenure >= 24:
                negative_factors.append("Established tenure history (longer than 2 years)")
            elif "contract_two year" in name and contract == "Two year":
                negative_factors.append("Stability of a two-year lock-in contract plan")
            elif "dependents" in name and dependents == "Yes":
                negative_factors.append("Family attachment indicators (having active dependents)")
            elif "tech support_yes" in name and tech_support == "Yes":
                negative_factors.append("Access to direct Tech Support service assistance")

    # Construct the explanation paragraph
    explanation = "The customer churn risk profile is heavily influenced by key indicators. "
    if positive_factors:
        explanation += "Specifically, churn probability is heightened due to: " + ", ".join(positive_factors).lower() + ". "
    if negative_factors:
        explanation += "Conversely, risk is significantly mitigated by stabilizing elements like: " + ", ".join(negative_factors).lower() + "."
    else:
        explanation += "No significant retention stabilizers were identified in their current profile."

    # Actionable Business Recommendations
    recommendations = []
    if contract == "Month-to-month":
        recommendations.append("Propose a two-year contract conversion plan offering a 15% discount incentive.")
    if internet == "Fiber optic" and tech_support == "No":
        recommendations.append("Offer a free 3-month trial of Premium Tech Support to address reliability complaints.")
    if tech_support == "No":
        recommendations.append("Bundle technical assistance support as an automated add-on package.")
    if tenure < 12:
        recommendations.append("Schedule a proactive loyalty check-in call and offer a new customer anniversary reward.")
    if monthly_charges > 80:
        recommendations.append("Conduct a billing check to audit service bundles and suggest cost-optimized alternatives.")
    
    # Default recommendations if list is short
    if len(recommendations) < 2:
        recommendations.append("Provide customized discount coupons or loyalty reward points.")
        recommendations.append("Send proactive feedback emails to monitor customer satisfaction scores.")
        
    return explanation, recommendations[:4]

def predict_customer(data, skip_shap=False):
    """Preprocesses a single customer dictionary and outputs prediction details + SHAP values."""
    global _scaler, _model, _columns_list, _explainer
    
    if _model is None or _scaler is None:
        initialized = init_prediction_service()
        if not initialized:
            raise RuntimeError("Model files not loaded. Unable to make predictions.")
            
    # Preprocess
    df_row = preprocess_input(data)
    
    # Scale
    scaled_row = _scaler.transform(df_row)
    
    # Predict probability
    prob = float(_model.predict_proba(scaled_row)[0][1])
    prediction = "Customer Will Churn" if prob >= 0.5 else "Customer Will Stay"
    risk_level = "High" if prob >= 0.7 else "Medium" if prob >= 0.3 else "Low"
    
    # Map features to titles for UI presentation
    top_features = []
    
    if skip_shap:
        # Fast contribution calculation (coef * scaled_value) for batch prediction.
        # This is mathematically proportional to linear model feature importances.
        coefs = _model.coef_[0]
        shap_vals = coefs * scaled_row[0]
        for i, col in enumerate(_columns_list):
            top_features.append({
                "feature": col.replace("_", " ").title(),
                "impact": float(shap_vals[i])
            })
    else:
        # Compute SHAP
        shap_vals = _explainer.shap_values(scaled_row)[0]
        for i, col in enumerate(_columns_list):
            top_features.append({
                "feature": col.replace("_", " ").title(),
                "impact": float(shap_vals[i])
            })
        
    # Sort top features by absolute impact
    top_features.sort(key=lambda x: abs(x["impact"]), reverse=True)
    
    # Generate business summaries
    summary, recommendations = generate_insights(data, top_features)
    
    return {
        "prediction": prediction,
        "probability": prob,
        "risk_level": risk_level,
        "business_summary": summary,
        "recommendations": recommendations,
        "top_features": top_features[:10] # Return top 10 features for charts
    }
