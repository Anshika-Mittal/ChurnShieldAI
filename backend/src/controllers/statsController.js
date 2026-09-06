import mongoose from "mongoose";
import { Prediction } from "../models/Prediction.js";
import { BatchJob } from "../models/BatchJob.js";
import { BatchPredictionResult } from "../models/BatchPredictionResult.js";

export const statsController = {
  /**
   * GET /api/prediction/stats
   */
  async getDashboardStats(req, res, next) {
    try {
      const userId = new mongoose.Types.ObjectId(String(req.userId));
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [totalSingle, totalBatches] = await Promise.all([
        Prediction.countDocuments({ user_id: userId }),
        BatchJob.countDocuments({ user_id: userId }),
      ]);

      // Aggregate single predictions stats
      const singleStatsAgg = await Prediction.aggregate([
        { $match: { user_id: userId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            churn: {
              $sum: { $cond: [{ $eq: ["$prediction", "Customer Will Churn"] }, 1, 0] },
            },
            high: { $sum: { $cond: [{ $eq: ["$risk_level", "High"] }, 1, 0] } },
            low: { $sum: { $cond: [{ $eq: ["$risk_level", "Low"] }, 1, 0] } },
            prob_sum: { $sum: "$probability" },
          },
        },
      ]);

      // Aggregate batch predictions stats
      const batchStatsAgg = await BatchJob.aggregate([
        { $match: { user_id: userId } },
        {
          $lookup: {
            from: "batch_prediction_results",
            localField: "_id",
            foreignField: "batch_id",
            as: "results",
          },
        },
        { $unwind: "$results" },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            churn: {
              $sum: {
                $cond: [{ $eq: ["$results.prediction", "Customer Will Churn"] }, 1, 0],
              },
            },
            high: {
              $sum: { $cond: [{ $eq: ["$results.risk_level", "High"] }, 1, 0] },
            },
            low: {
              $sum: { $cond: [{ $eq: ["$results.risk_level", "Low"] }, 1, 0] },
            },
            prob_sum: { $sum: "$results.probability" },
          },
        },
      ]);

      const s = singleStatsAgg[0] || { count: 0, churn: 0, high: 0, low: 0, prob_sum: 0 };
      const b = batchStatsAgg[0] || { count: 0, churn: 0, high: 0, low: 0, prob_sum: 0 };

      const totalCustomers = s.count + b.count;
      const churnCount = s.churn + b.churn;
      const highRisk = s.high + b.high;
      const lowRisk = s.low + b.low;
      const avgProb = totalCustomers > 0 ? (s.prob_sum + b.prob_sum) / totalCustomers : 0;

      // Time-based counts
      const [singleWeek, singleMonth, batchWeekAgg, batchMonthAgg] = await Promise.all([
        Prediction.countDocuments({ user_id: userId, created_at: { $gte: weekAgo } }),
        Prediction.countDocuments({ user_id: userId, created_at: { $gte: monthAgo } }),
        BatchJob.aggregate([
          { $match: { user_id: userId, created_at: { $gte: weekAgo } } },
          { $group: { _id: null, total: { $sum: "$total_records" } } },
        ]),
        BatchJob.aggregate([
          { $match: { user_id: userId, created_at: { $gte: monthAgo } } },
          { $group: { _id: null, total: { $sum: "$total_records" } } },
        ]),
      ]);

      const weekCount = singleWeek + (batchWeekAgg[0]?.total || 0);
      const monthCount = singleMonth + (batchMonthAgg[0]?.total || 0);

      // Top influential feature aggregation
      const topFeatureAgg = await Prediction.aggregate([
        { $match: { user_id: userId } },
        { $unwind: "$top_features" },
        {
          $group: {
            _id: "$top_features.feature",
            impact: { $sum: { $abs: "$top_features.impact" } },
          },
        },
        { $sort: { impact: -1 } },
        { $limit: 1 },
      ]);

      const mostInfluential = topFeatureAgg[0]?._id || "Contract Month To Month";
      const nonChurnCount = totalCustomers - churnCount;
      const churnPct = totalCustomers > 0 ? (churnCount / totalCustomers) * 100 : 0;
      const nonChurnPct = totalCustomers > 0 ? (nonChurnCount / totalCustomers) * 100 : 0;

      return res.status(200).json({
        total_predictions: totalSingle,
        total_batch_uploads: totalBatches,
        total_customers_analyzed: totalCustomers,
        high_risk_customers: highRisk,
        low_risk_customers: lowRisk,
        churn_percentage: Math.round(churnPct * 100) / 100,
        non_churn_percentage: Math.round(nonChurnPct * 100) / 100,
        predictions_this_week: weekCount,
        predictions_this_month: monthCount,
        most_influential_feature: mostInfluential,
        avg_churn_probability: Math.round(avgProb * 10000) / 10000,
      });
    } catch (err) {
      next(err);
    }
  },
};
