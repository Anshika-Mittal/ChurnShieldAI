import unittest
import json
import os
from predictor import init_model, is_ready, get_columns, preprocess_dict, preprocess_batch_list
from explainer import explain_single, explain_batch, generate_insights
from app import app

class TestMLService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_model()
        cls.client = app.test_client()

    def test_initialization(self):
        self.assertTrue(is_ready())
        self.assertEqual(len(get_columns()), 33)

    def test_health_endpoint(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["model_loaded"])
        self.assertEqual(data["features_count"], 33)

    def test_columns_endpoint(self):
        res = self.client.get("/columns")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data["columns"]), 33)

    def test_single_prediction_endpoint(self):
        sample_customer = {
            "gender": "Female",
            "senior_citizen": "No",
            "partner": "No",
            "dependents": "No",
            "tenure_months": 2,
            "phone_service": "Yes",
            "multiple_lines": "No",
            "internet_service": "Fiber optic",
            "online_security": "No",
            "online_backup": "No",
            "device_protection": "No",
            "tech_support": "No",
            "streaming_tv": "No",
            "streaming_movies": "No",
            "contract": "Month-to-month",
            "paperless_billing": "Yes",
            "payment_method": "Electronic check",
            "monthly_charges": 70.7,
            "total_charges": 151.65
        }
        res = self.client.post("/predict", json={"features": sample_customer})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("prediction", data)
        self.assertIn("probability", data)
        self.assertIn("risk_level", data)
        self.assertIn("business_summary", data)
        self.assertIn("recommendations", data)
        self.assertIn("top_features", data)
        self.assertGreater(len(data["top_features"]), 0)
        self.assertTrue(0.0 <= data["probability"] <= 1.0)

    def test_batch_prediction_endpoint(self):
        records = [
            {
                "gender": "Female",
                "senior_citizen": "No",
                "partner": "No",
                "dependents": "No",
                "tenure_months": 2,
                "phone_service": "Yes",
                "multiple_lines": "No",
                "internet_service": "Fiber optic",
                "online_security": "No",
                "online_backup": "No",
                "device_protection": "No",
                "tech_support": "No",
                "streaming_tv": "No",
                "streaming_movies": "No",
                "contract": "Month-to-month",
                "paperless_billing": "Yes",
                "payment_method": "Electronic check",
                "monthly_charges": 70.7,
                "total_charges": 151.65
            },
            {
                "gender": "Male",
                "senior_citizen": "No",
                "partner": "Yes",
                "dependents": "Yes",
                "tenure_months": 60,
                "phone_service": "Yes",
                "multiple_lines": "Yes",
                "internet_service": "DSL",
                "online_security": "Yes",
                "online_backup": "Yes",
                "device_protection": "Yes",
                "tech_support": "Yes",
                "streaming_tv": "No",
                "streaming_movies": "No",
                "contract": "Two year",
                "paperless_billing": "No",
                "payment_method": "Credit card (automatic)",
                "monthly_charges": 45.0,
                "total_charges": 2700.0
            }
        ]
        res = self.client.post("/predict/batch", json={"records": records})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["predictions"]), 2)
        self.assertIn("prediction", data["predictions"][0])
        self.assertIn("probability", data["predictions"][0])
        self.assertIn("top_features", data["predictions"][0])

if __name__ == "__main__":
    unittest.main()
