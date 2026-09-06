import { BatchJob } from "../models/BatchJob.js";
import { BatchPredictionResult } from "../models/BatchPredictionResult.js";
import { batchService } from "../services/batchService.js";
import { logger } from "../utils/logger.js";
import { format as formatCSV } from "fast-csv";

export const batchController = {
  /**
   * POST /api/prediction/predict-batch
   */
  async predictBatch(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded. Please select a CSV file." });
      }

      if (!req.file.originalname.endsWith(".csv")) {
        return res.status(400).json({ message: "Invalid file format. Only CSV files are supported." });
      }

      // 1. Parse CSV
      const rawRows = await batchService.parseCSVBuffer(req.file.buffer);
      const totalRows = rawRows.length;

      if (totalRows === 0) {
        return res.status(400).json({ message: "Uploaded CSV file is empty." });
      }

      if (totalRows > 10000) {
        return res.status(400).json({
          message: "Maximum batch upload size of 10000 records exceeded.",
        });
      }

      // 2. Validate columns
      const validation = batchService.validateColumns(rawRows[0]);
      if (!validation.valid) {
        return res.status(400).json({
          message: "Missing required columns in CSV.",
          missing_columns: validation.missingColumns,
        });
      }

      // 3. Create BatchJob tracking document
      const batchDoc = await BatchJob.create({
        user_id: req.userId,
        file_name: req.file.originalname,
        total_records: totalRows,
        processed_records: 0,
        status: "PROCESSING",
      });

      const batchId = String(batchDoc._id);

      // Sync by default so the React client can fetch results immediately.
      // Pass ?async=true for background jobs (large uploads / custom clients).
      const isAsync = req.query.async === "true";

      if (isAsync) {
        // Kick off in background and return job immediately
        batchService.processBatchJob(batchId, rawRows).catch((err) => {
          logger.error(`Async batch processing background error: ${err.message}`);
        });

        return res.status(202).json({
          message: "Batch prediction job initiated.",
          batch_id: batchId,
          jobId: batchId,
          status: "PROCESSING",
          total_records: totalRows,
        });
      } else {
        // Await processing for smaller batches so that frontend receives immediate summary
        await batchService.processBatchJob(batchId, rawRows);
        const updatedBatch = await BatchJob.findById(batchId);
        const previewResults = await BatchPredictionResult.find({ batch_id: batchId })
          .limit(15)
          .lean();

        return res.status(200).json({
          message: "Batch prediction completed successfully.",
          batch_id: batchId,
          jobId: batchId,
          status: updatedBatch.status,
          total_records: totalRows,
          summary: updatedBatch.summary,
          preview: previewResults.map((r) => ({
            customer_number: r.customer_number,
            prediction: r.prediction,
            probability: r.probability,
            risk_level: r.risk_level,
          })),
        });
      }
    } catch (err) {
      logger.error(`Batch prediction error: ${err.message}`);
      return res.status(500).json({ message: `Batch CSV processing failed: ${err.message}` });
    }
  },

  /**
   * GET /api/prediction/batch/:batchId and GET /api/predictions/batch/:jobId
   */
  async getBatch(req, res, next) {
    try {
      const batchId = req.params.batchId || req.params.jobId;
      const batch = await BatchJob.findOne({
        _id: batchId,
        user_id: req.userId,
      }).lean();

      if (!batch) {
        return res.status(404).json({ message: "Batch record not found." });
      }

      const results = await BatchPredictionResult.find({ batch_id: batch._id }).lean();

      const progress =
        batch.total_records > 0
          ? Math.round((batch.processed_records / batch.total_records) * 100)
          : 0;

      return res.status(200).json({
        _id: String(batch._id),
        jobId: String(batch._id),
        batch_id: String(batch._id),
        user_id: String(batch.user_id),
        file_name: batch.file_name,
        total: batch.total_records,
        total_records: batch.total_records,
        processed: batch.processed_records,
        processed_records: batch.processed_records,
        failed: batch.failed_records,
        progress,
        status: batch.status,
        summary: batch.summary,
        results: results.map((r) => ({
          _id: String(r._id),
          batch_id: String(r.batch_id),
          customer_number: r.customer_number,
          input_data: r.input_data,
          prediction: r.prediction,
          probability: r.probability,
          risk_level: r.risk_level,
          top_features: r.top_features,
        })),
        created_at: batch.created_at,
        completed_at: batch.completed_at,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/prediction/batch/:batchId
   */
  async deleteBatch(req, res, next) {
    try {
      const batchId = req.params.batchId || req.params.jobId;
      const batch = await BatchJob.findOne({
        _id: batchId,
        user_id: req.userId,
      });

      if (!batch) {
        return res.status(404).json({
          message: "Failed to delete batch or record not found.",
        });
      }

      // Delete results and job
      await BatchPredictionResult.deleteMany({ batch_id: batch._id });
      await BatchJob.deleteOne({ _id: batch._id });

      return res.status(200).json({ message: "Batch records deleted successfully." });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/prediction/download-results/:batchId
   */
  async downloadResults(req, res, next) {
    try {
      const batchId = req.params.batchId;
      const batch = await BatchJob.findOne({
        _id: batchId,
        user_id: req.userId,
      });

      if (!batch) {
        return res.status(404).json({ message: "Batch record not found." });
      }

      const results = await BatchPredictionResult.find({ batch_id: batch._id }).lean();

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="batch_results_${batchId}.csv"`
      );

      const csvStream = formatCSV({ headers: true });
      csvStream.pipe(res);

      for (const r of results) {
        const inp = r.input_data || {};
        csvStream.write({
          "Customer ID": r.customer_number,
          Prediction: r.prediction,
          Probability: `${(r.probability * 100).toFixed(2)}%`,
          "Risk Level": r.risk_level,
          Contract: inp.contract || "",
          "Tenure Months": inp.tenure_months ?? "",
          "Monthly Charges": inp.monthly_charges ?? "",
          "Total Charges": inp.total_charges ?? "",
        });
      }

      csvStream.end();
    } catch (err) {
      next(err);
    }
  },
};
