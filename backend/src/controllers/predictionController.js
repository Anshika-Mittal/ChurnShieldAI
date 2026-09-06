import { Prediction } from "../models/Prediction.js";
import { Customer } from "../models/Customer.js";
import { mlService } from "../services/mlService.js";
import { logger } from "../utils/logger.js";

export const predictionController = {
  /**
   * POST /api/prediction/predict
   */
  async predictSingle(req, res, next) {
    try {
      const { customer_data } = req.body || {};

      if (!customer_data) {
        return res.status(400).json({ message: "Customer data payload is missing." });
      }

      // Call Python ML microservice
      const mlResult = await mlService.predictSingle(customer_data);

      // Save to prediction history in MongoDB
      const doc = await Prediction.create({
        user_id: req.userId,
        prediction_type: "single",
        input_data: customer_data,
        prediction: mlResult.prediction,
        probability: mlResult.probability,
        risk_level: mlResult.risk_level,
        business_summary: mlResult.business_summary,
        recommendations: mlResult.recommendations,
        top_features: mlResult.top_features,
      });

      // If customer exists with matching ID, link prediction
      const customerId = customer_data.customer_id || customer_data.customerId;
      if (customerId) {
        await Customer.findOneAndUpdate(
          { user_id: req.userId, customer_id: customerId },
          { last_prediction_id: doc._id }
        );
      }

      return res.status(200).json({
        message: "Prediction calculated successfully.",
        prediction_id: String(doc._id),
        result: mlResult,
      });
    } catch (err) {
      logger.error(`Single prediction execution error: ${err.message}`);
      return res.status(500).json({
        message: `Prediction model execution failed: ${err.message}`,
      });
    }
  },

  /**
   * GET /api/prediction/history
   */
  async getHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page || "1", 10);
      const perPage = parseInt(req.query.per_page || req.query.limit || "10", 10);
      const riskLevel = req.query.risk_level;
      const prediction = req.query.prediction;
      const sortBy = req.query.sort_by || "created_at";
      const sortDir = req.query.sort_dir === "asc" ? 1 : -1;

      const query = { user_id: req.userId };

      if (riskLevel) {
        query.risk_level = riskLevel;
      }
      if (prediction) {
        query.prediction = prediction;
      }

      if (req.query.start_date || req.query.end_date) {
        query.created_at = {};
        if (req.query.start_date) {
          query.created_at.$gte = new Date(req.query.start_date);
        }
        if (req.query.end_date) {
          query.created_at.$lte = new Date(req.query.end_date);
        }
      }

      const total = await Prediction.countDocuments(query);
      const predictions = await Prediction.find(query)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * perPage)
        .limit(perPage);

      const formatted = predictions.map((doc) => ({
        _id: String(doc._id),
        user_id: String(doc.user_id),
        prediction_type: doc.prediction_type,
        input_data: doc.input_data,
        prediction: doc.prediction,
        probability: doc.probability,
        risk_level: doc.risk_level,
        business_summary: doc.business_summary,
        recommendations: doc.recommendations,
        top_features: doc.top_features,
        created_at: doc.created_at,
      }));

      return res.status(200).json({
        predictions: formatted,
        total,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/prediction/prediction/:id
   */
  async getPredictionDetails(req, res, next) {
    try {
      const doc = await Prediction.findOne({
        _id: req.params.id,
        user_id: req.userId,
      });

      if (!doc) {
        return res.status(404).json({ message: "Prediction record not found." });
      }

      return res.status(200).json({
        _id: String(doc._id),
        user_id: String(doc.user_id),
        input_data: doc.input_data,
        prediction: doc.prediction,
        probability: doc.probability,
        risk_level: doc.risk_level,
        business_summary: doc.business_summary,
        recommendations: doc.recommendations,
        top_features: doc.top_features,
        created_at: doc.created_at,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/prediction/prediction/:id
   */
  async deleteSinglePrediction(req, res, next) {
    try {
      const deleted = await Prediction.findOneAndDelete({
        _id: req.params.id,
        user_id: req.userId,
      });

      if (!deleted) {
        return res.status(404).json({
          message: "Failed to delete prediction or record not found.",
        });
      }

      return res.status(200).json({ message: "Prediction record deleted successfully." });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/prediction/predictions
   */
  async clearAllPredictions(req, res, next) {
    try {
      await Prediction.deleteMany({ user_id: req.userId });
      return res.status(200).json({
        message: "All prediction history cleared successfully.",
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /get_col (Legacy endpoint)
   */
  async getColumns(req, res, next) {
    try {
      const cols = await mlService.getColumns();
      return res.status(200).json({ columns: cols });
    } catch (err) {
      next(err);
    }
  },
};
