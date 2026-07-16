import os
import sys
import logging
from datetime import datetime

# Ensure the server directory is in sys.path to allow running server.py directly
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database.connection import init_db
from services.prediction_service import init_prediction_service
from routes.auth import auth_bp
from routes.prediction import prediction_bp
import util as legacy_util

# Set up logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for the React client running on port 5173 (Vite standard)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(prediction_bp, url_prefix="/api/prediction")

@app.route("/get_col")
def get_col():
    """Legacy endpoint compatibility check."""
    if legacy_util.get_columns() is None:
        legacy_util.load_saved_artifacts()
    response = jsonify({
        'columns': legacy_util.get_columns()
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint reflecting service status."""
    from server.database.connection import is_demo_mode
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat() if 'datetime' in globals() else "",
        "database": "mock_in_memory" if is_demo_mode() else "mongodb_connected"
    }), 200

# Error Handler
@app.errorhandler(404)
def not_found(e):
    return jsonify({"message": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"message": f"Internal Server Error: {str(e)}"}), 500

if __name__ == '__main__':
    # Initialize DB and scaler once during server startup
    logger.info("Initializing application layers...")
    init_db()
    init_prediction_service()
    
    # Load legacy artifacts for legacy compatibility
    legacy_util.load_saved_artifacts()
    
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting Flask server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)