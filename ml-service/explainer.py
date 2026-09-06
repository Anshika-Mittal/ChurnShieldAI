import logging

logger = logging.getLogger("ml_service.explainer")

def generate_insights(data, top_features):
    """
    Generates natural language explanation and actionable business recommendations
    based on feature impacts.
    """
    positive_factors = []
    negative_factors = []

    tenure = int(data.get("tenure_months", 0) or 0)
    contract = str(data.get("contract", "Month-to-month"))
    internet = str(data.get("internet_service", "No"))
    dependents = str(data.get("dependents", "No"))
    tech_support = str(data.get("tech_support", "No"))
    monthly_charges = float(data.get("monthly_charges", 0.0) or 0.0)

    for item in top_features[:10]:
        name = item["feature"].lower()
        impact = item["impact"]

        if impact > 0:  # Increases churn risk
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
        else:  # Decreases churn risk
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

    if len(recommendations) < 2:
        recommendations.append("Provide customized discount coupons or loyalty reward points.")
        recommendations.append("Send proactive feedback emails to monitor customer satisfaction scores.")

    return explanation, recommendations[:4]

def explain_single(model, explainer, scaler, columns_list, df_row, raw_data, skip_shap=False):
    """
    Computes churn probability, risk level, SHAP feature impact rankings,
    and business recommendations for a single customer.
    """
    scaled_row = scaler.transform(df_row)
    prob = float(model.predict_proba(scaled_row)[0][1])
    prediction = "Customer Will Churn" if prob >= 0.5 else "Customer Will Stay"
    risk_level = "High" if prob >= 0.7 else "Medium" if prob >= 0.3 else "Low"

    top_features = []
    if skip_shap or explainer is None:
        coefs = model.coef_[0]
        shap_vals = coefs * scaled_row[0]
        for i, col in enumerate(columns_list):
            top_features.append({
                "feature": col.replace("_", " ").title(),
                "impact": float(shap_vals[i])
            })
    else:
        shap_vals = explainer.shap_values(scaled_row)[0]
        for i, col in enumerate(columns_list):
            top_features.append({
                "feature": col.replace("_", " ").title(),
                "impact": float(shap_vals[i])
            })

    top_features.sort(key=lambda x: abs(x["impact"]), reverse=True)
    summary, recommendations = generate_insights(raw_data, top_features)

    return {
        "prediction": prediction,
        "probability": prob,
        "risk_level": risk_level,
        "business_summary": summary,
        "recommendations": recommendations,
        "top_features": top_features[:10]
    }

def explain_batch(model, scaler, columns_list, df_batch, raw_records):
    """
    Vectorized batch inference and feature impact calculation for high throughput.
    """
    scaled_batch = scaler.transform(df_batch)
    probabilities = model.predict_proba(scaled_batch)[:, 1]
    coefs = model.coef_[0]
    batch_shap = scaled_batch * coefs  # (N, 33)

    results = []
    for idx, raw_data in enumerate(raw_records):
        prob = float(probabilities[idx])
        prediction = "Customer Will Churn" if prob >= 0.5 else "Customer Will Stay"
        risk_level = "High" if prob >= 0.7 else "Medium" if prob >= 0.3 else "Low"

        row_shap = batch_shap[idx]
        top_features = []
        for i, col in enumerate(columns_list):
            top_features.append({
                "feature": col.replace("_", " ").title(),
                "impact": float(row_shap[i])
            })
        top_features.sort(key=lambda x: abs(x["impact"]), reverse=True)

        results.append({
            "prediction": prediction,
            "probability": prob,
            "risk_level": risk_level,
            "top_features": top_features[:10]
        })

    return results
