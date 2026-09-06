import os
import sys
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure local module imports work
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

load_dotenv()

from predictor import init_model, is_ready, get_columns, get_model, get_scaler, get_explainer, preprocess_dict, preprocess_batch_list
from explainer import explain_single, explain_batch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [ML-SERVICE] %(name)s: %(message)s"
)
logger = logging.getLogger("ml_service")

app = Flask(__name__)
CORS(app)

# Initialize ML artifacts on app startup
try:
    init_model()
except Exception as e:
    logger.exception(f"Failed to initialize ML models on startup: {e}")

@app.route("/health", methods=["GET"])
def health_check():
    """Health check reflecting model readiness status."""
    return jsonify({
        "status": "healthy" if is_ready() else "initializing",
        "service": "customer-churn-ml-microservice",
        "model_loaded": is_ready(),
        "features_count": len(get_columns()) if get_columns() else 0
    }), 200 if is_ready() else 503

@app.route("/columns", methods=["GET"])
def columns():
    """Returns the ordered 33 model columns."""
    if not is_ready():
        init_model()
    return jsonify({
        "columns": get_columns()
    }), 200

@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict churn for a single customer payload with SHAP explanations.
    Accepts { "features": { ... } } or { "customer_data": { ... } }
    """
    if not is_ready():
        init_model()

    data = request.get_json() or {}
    customer_data = data.get("features") or data.get("customer_data") or data
    
    if not customer_data:
        return jsonify({"message": "Customer data payload is missing."}), 400

    skip_shap = bool(data.get("skip_shap", False))

    try:
        df_row = preprocess_dict(customer_data)
        result = explain_single(
            model=get_model(),
            explainer=get_explainer(),
            scaler=get_scaler(),
            columns_list=get_columns(),
            df_row=df_row,
            raw_data=customer_data,
            skip_shap=skip_shap
        )
        return jsonify(result), 200
    except Exception as e:
        logger.exception("Single prediction inference failed:")
        return jsonify({"message": f"Inference failed: {str(e)}"}), 500

@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """
    Vectorized high-throughput batch prediction.
    Accepts { "records": [ { ... } ] }
    """
    if not is_ready():
        init_model()

    data = request.get_json() or {}
    records = data.get("records", [])

    if not isinstance(records, list) or len(records) == 0:
        return jsonify({"message": "Records array is empty or missing."}), 400

    try:
        df_batch = preprocess_batch_list(records)
        results = explain_batch(
            model=get_model(),
            scaler=get_scaler(),
            columns_list=get_columns(),
            df_batch=df_batch,
            raw_records=records
        )
        return jsonify({
            "count": len(results),
            "predictions": results
        }), 200
    except Exception as e:
        logger.exception("Batch prediction inference failed:")
        return jsonify({"message": f"Batch inference failed: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("ML_PORT", 5001))
    logger.info(f"Starting Python ML Microservice on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
