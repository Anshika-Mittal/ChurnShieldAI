import io
import csv
import logging
import pandas as pd
from datetime import datetime
from flask import Blueprint, request, jsonify, g, send_file
from middleware.jwt_auth import token_required
from database.predictions import (
    save_prediction, get_prediction_history, get_prediction_details,
    delete_prediction, delete_all_predictions, get_dashboard_stats
)
from database.batches import (
    create_batch, add_batch_results, update_batch_status, get_batch_details, delete_batch
)
from services.prediction_service import predict_customer

logger = logging.getLogger(__name__)
prediction_bp = Blueprint("prediction", __name__)

def safe_float(val, default=0.0):
    if pd.isna(val):
        return default
    val_str = str(val).strip()
    if not val_str:
        return default
    try:
        return float(val_str)
    except ValueError:
        return default

def safe_int(val, default=0):
    if pd.isna(val):
        return default
    val_str = str(val).strip()
    if not val_str:
        return default
    try:
        return int(float(val_str))
    except ValueError:
        return default

REQUIRED_COLUMNS = [
    "gender", "senior_citizen", "partner", "dependents", "tenure_months",
    "phone_service", "multiple_lines", "internet_service", "online_security",
    "online_backup", "device_protection", "tech_support", "streaming_tv",
    "streaming_movies", "contract", "paperless_billing", "payment_method",
    "monthly_charges", "total_charges"
]

@prediction_bp.route("/predict", methods=["POST"])
@token_required
def predict_single():
    """Predicts churn risk for a single customer and saves to user history."""
    data = request.get_json() or {}
    customer_data = data.get("customer_data")
    
    if not customer_data:
        return jsonify({"message": "Customer data payload is missing."}), 400
        
    try:
        # Run prediction
        res = predict_customer(customer_data)
        
        # Save to database
        db_doc = save_prediction(
            user_id=g.user_id,
            input_data=customer_data,
            prediction=res["prediction"],
            probability=res["probability"],
            risk_level=res["risk_level"],
            business_summary=res["business_summary"],
            recommendations=res["recommendations"],
            top_features=res["top_features"]
        )
        
        return jsonify({
            "message": "Prediction calculated successfully.",
            "prediction_id": str(db_doc["_id"]),
            "result": res
        }), 200
    except Exception as e:
        logger.exception("Single prediction error:")
        return jsonify({"message": f"Prediction model execution failed: {str(e)}"}), 500

@prediction_bp.route("/predict-batch", methods=["POST"])
@token_required
def predict_batch():
    """Processes uploaded customer CSV file, validates rows, runs predictions, and saves batch."""
    if "file" not in request.files:
        return jsonify({"message": "No file uploaded. Please select a CSV file."}), 400
        
    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"message": "Invalid file format. Only CSV files are supported."}), 400
        
    try:
        # Read CSV using pandas
        csv_bytes = file.read()
        df = pd.read_csv(io.BytesIO(csv_bytes))
        
        # 1. Row limit check
        total_rows = len(df)
        if total_rows == 0:
            return jsonify({"message": "Uploaded CSV file is empty."}), 400
        if total_rows > 10000:
            return jsonify({"message": "Maximum batch upload size of 10000 records exceeded."}), 400
            
        # 2. Normalize columns
        original_cols = df.columns.tolist()
        df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
        
        # 3. Check for missing columns
        missing_cols = []
        for req in REQUIRED_COLUMNS:
            if req not in df.columns:
                missing_cols.append(req.replace("_", " ").title())
                
        if missing_cols:
            return jsonify({
                "message": "Missing required columns in CSV.",
                "missing_columns": missing_cols
            }), 400
            
        # Create batch tracking entry in DB
        batch_doc = create_batch(
            user_id=g.user_id,
            file_name=file.filename,
            total_records=total_rows
        )
        batch_id = str(batch_doc["_id"])
        
        # 4. Predict each row
        results_list = []
        for idx, row in df.iterrows():
            # Build customer dictionary
            customer_no = row.get("customerid", f"CUST-{idx+1:04d}")
            customer_data = {
                "gender": str(row["gender"]),
                "senior_citizen": str(row["senior_citizen"]),
                "partner": str(row["partner"]),
                "dependents": str(row["dependents"]),
                "tenure_months": safe_int(row["tenure_months"]),
                "phone_service": str(row["phone_service"]),
                "multiple_lines": str(row["multiple_lines"]),
                "internet_service": str(row["internet_service"]),
                "online_security": str(row["online_security"]),
                "online_backup": str(row["online_backup"]),
                "device_protection": str(row["device_protection"]),
                "tech_support": str(row["tech_support"]),
                "streaming_tv": str(row["streaming_tv"]),
                "streaming_movies": str(row["streaming_movies"]),
                "contract": str(row["contract"]),
                "paperless_billing": str(row["paperless_billing"]),
                "payment_method": str(row["payment_method"]),
                "monthly_charges": safe_float(row["monthly_charges"]),
                "total_charges": safe_float(row["total_charges"])
            }
            
            # Predict
            pred = predict_customer(customer_data, skip_shap=True)
            
            results_list.append({
                "customer_number": str(customer_no),
                "input_data": customer_data,
                "prediction": pred["prediction"],
                "probability": pred["probability"],
                "risk_level": pred["risk_level"],
                "top_features": pred["top_features"]
            })
            
        # Bulk insert prediction results
        add_batch_results(batch_id, results_list)
        # Update batch completion status
        update_batch_status(batch_id, "Completed", len(results_list))
        
        # Return summary analytics for frontend visual charts
        churn_count = sum(1 for r in results_list if r["prediction"] == "Customer Will Churn")
        high_risk = sum(1 for r in results_list if r["risk_level"] == "High")
        medium_risk = sum(1 for r in results_list if r["risk_level"] == "Medium")
        low_risk = sum(1 for r in results_list if r["risk_level"] == "Low")
        
        return jsonify({
            "message": "Batch prediction completed successfully.",
            "batch_id": batch_id,
            "total_records": total_rows,
            "summary": {
                "churn_count": churn_count,
                "stay_count": total_rows - churn_count,
                "high_risk": high_risk,
                "medium_risk": medium_risk,
                "low_risk": low_risk
            },
            # Return preview of first 10 records to display immediately
            "preview": [{
                "customer_number": r["customer_number"],
                "prediction": r["prediction"],
                "probability": r["probability"],
                "risk_level": r["risk_level"]
            } for r in results_list[:15]]
        }), 200
        
    except Exception as e:
        logger.exception("Batch prediction failure:")
        return jsonify({"message": f"Batch CSV processing failed: {str(e)}"}), 500

@prediction_bp.route("/history", methods=["GET"])
@token_required
def history():
    """Retrieves paginated user prediction history with sorting and filtering."""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))
    risk_level = request.args.get("risk_level")
    prediction = request.args.get("prediction")
    sort_by = request.args.get("sort_by", "created_at")
    sort_dir = request.args.get("sort_dir", "desc")
    
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    
    start_date = None
    end_date = None
    if start_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str)
        except ValueError:
            pass
    if end_date_str:
        try:
            end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            pass
            
    res = get_prediction_history(
        user_id=g.user_id,
        page=page,
        per_page=per_page,
        start_date=start_date,
        end_date=end_date,
        risk_level=risk_level,
        prediction=prediction,
        sort_by=sort_by,
        sort_dir=sort_dir
    )
    
    return jsonify(res), 200

@prediction_bp.route("/prediction/<prediction_id>", methods=["GET"])
@token_required
def get_prediction(prediction_id):
    """Retrieves detail explanation for a single prediction ID."""
    doc = get_prediction_details(g.user_id, prediction_id)
    if not doc:
        return jsonify({"message": "Prediction record not found."}), 404
    return jsonify(doc), 200

@prediction_bp.route("/prediction/<prediction_id>", methods=["DELETE"])
@token_required
def delete_single_prediction(prediction_id):
    """Deletes a single prediction from user history."""
    deleted = delete_prediction(g.user_id, prediction_id)
    if not deleted:
        return jsonify({"message": "Failed to delete prediction or record not found."}), 404
    return jsonify({"message": "Prediction record deleted successfully."}), 200

@prediction_bp.route("/predictions", methods=["DELETE"])
@token_required
def clear_all_predictions():
    """Deletes all prediction history records for the current user."""
    delete_all_predictions(g.user_id)
    return jsonify({"message": "All prediction history cleared successfully."}), 200

@prediction_bp.route("/batch/<batch_id>", methods=["GET"])
@token_required
def get_batch(batch_id):
    """Retrieves batch upload details and all contained prediction records."""
    doc = get_batch_details(g.user_id, batch_id)
    if not doc:
        return jsonify({"message": "Batch record not found."}), 404
    return jsonify(doc), 200

@prediction_bp.route("/batch/<batch_id>", methods=["DELETE"])
@token_required
def remove_batch(batch_id):
    """Deletes a batch upload metadata and its prediction result rows."""
    deleted = delete_batch(g.user_id, batch_id)
    if not deleted:
        return jsonify({"message": "Failed to delete batch or record not found."}), 404
    return jsonify({"message": "Batch records deleted successfully."}), 200

@prediction_bp.route("/stats", methods=["GET"])
@token_required
def stats():
    """Retrieves analytics aggregation metrics for the dashboard charts."""
    res = get_dashboard_stats(g.user_id)
    return jsonify(res), 200

@prediction_bp.route("/download-results/<batch_id>", methods=["GET"])
@token_required
def download_results(batch_id):
    """Generates a downloadable CSV containing batch prediction results."""
    batch = get_batch_details(g.user_id, batch_id)
    if not batch:
        return jsonify({"message": "Batch record not found."}), 404
        
    results = batch.get("results", [])
    
    # Write CSV to memory buffer
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write Header
    writer.writerow([
        "Customer ID", "Prediction", "Probability", "Risk Level", 
        "Contract", "Tenure Months", "Monthly Charges", "Total Charges"
    ])
    
    # Write Rows
    for r in results:
        inp = r.get("input_data", {})
        writer.writerow([
            r.get("customer_number"),
            r.get("prediction"),
            f"{r.get('probability') * 100:.2f}%",
            r.get("risk_level"),
            inp.get("contract"),
            inp.get("tenure_months"),
            inp.get("monthly_charges"),
            inp.get("total_charges")
        ])
        
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"batch_results_{batch_id}.csv"
    )
