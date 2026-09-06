import { Readable } from "stream";
import csvParser from "csv-parser";
import { BatchJob } from "../models/BatchJob.js";
import { BatchPredictionResult } from "../models/BatchPredictionResult.js";
import { mlService } from "./mlService.js";
import { logger } from "../utils/logger.js";

export const REQUIRED_COLUMNS = [
  "gender",
  "senior_citizen",
  "partner",
  "dependents",
  "tenure_months",
  "phone_service",
  "multiple_lines",
  "internet_service",
  "online_security",
  "online_backup",
  "device_protection",
  "tech_support",
  "streaming_tv",
  "streaming_movies",
  "contract",
  "paperless_billing",
  "payment_method",
  "monthly_charges",
  "total_charges",
];

function safeFloat(val, defaultVal = 0.0) {
  if (val === undefined || val === null) return defaultVal;
  const num = parseFloat(String(val).trim());
  return isNaN(num) ? defaultVal : num;
}

function safeInt(val, defaultVal = 0) {
  if (val === undefined || val === null) return defaultVal;
  const num = parseInt(String(val).trim(), 10);
  return isNaN(num) ? defaultVal : num;
}

export const batchService = {
  /**
   * Parse CSV Buffer into array of normalized customer dictionaries.
   */
  async parseCSVBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(
          csvParser({
            mapHeaders: ({ header }) =>
              header.trim().toLowerCase().replace(/\s+/g, "_"),
          })
        )
        .on("data", (row) => results.push(row))
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });
  },

  /**
   * Validate presence of all required columns.
   */
  validateColumns(firstRow) {
    if (!firstRow) {
      return { valid: false, missingColumns: REQUIRED_COLUMNS };
    }

    const availableColumns = Object.keys(firstRow);
    const missingColumns = REQUIRED_COLUMNS.filter(
      (col) => !availableColumns.includes(col)
    ).map((col) =>
      col
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );

    return {
      valid: missingColumns.length === 0,
      missingColumns,
    };
  },

  /**
   * Normalize raw row to model input structure.
   */
  normalizeCustomerRow(row, idx) {
    const customerNo =
      row.customerid ||
      row.customer_id ||
      row.customer_no ||
      `CUST-${String(idx + 1).padStart(4, "0")}`;

    const customerData = {
      gender: String(row.gender || "Male"),
      senior_citizen: String(row.senior_citizen || "No"),
      partner: String(row.partner || "No"),
      dependents: String(row.dependents || "No"),
      tenure_months: safeInt(row.tenure_months, 0),
      phone_service: String(row.phone_service || "Yes"),
      multiple_lines: String(row.multiple_lines || "No"),
      internet_service: String(row.internet_service || "DSL"),
      online_security: String(row.online_security || "No"),
      online_backup: String(row.online_backup || "No"),
      device_protection: String(row.device_protection || "No"),
      tech_support: String(row.tech_support || "No"),
      streaming_tv: String(row.streaming_tv || "No"),
      streaming_movies: String(row.streaming_movies || "No"),
      contract: String(row.contract || "Month-to-month"),
      paperless_billing: String(row.paperless_billing || "Yes"),
      payment_method: String(row.payment_method || "Electronic check"),
      monthly_charges: safeFloat(row.monthly_charges, 0.0),
      total_charges: safeFloat(row.total_charges, 0.0),
    };

    return { customerNo, customerData };
  },

  /**
   * Asynchronously process a batch of records in chunks.
   * High performance chunked vector inference + bulkWrite / insertMany.
   */
  async processBatchJob(jobId, rawRows, chunkSize = 1000) {
    logger.info(`Starting asynchronous batch processing for job ${jobId} (${rawRows.length} records)...`);

    try {
      const total = rawRows.length;
      let processed = 0;
      let churnCount = 0;
      let highRisk = 0;
      let mediumRisk = 0;
      let lowRisk = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunkSlice = rawRows.slice(i, i + chunkSize);
        const normalizedChunk = chunkSlice.map((row, index) =>
          this.normalizeCustomerRow(row, i + index)
        );

        const recordsPayload = normalizedChunk.map((c) => c.customerData);

        // Vectorized inference via Python ML microservice
        const mlResponse = await mlService.predictBatch(recordsPayload);
        const predictions = mlResponse.predictions;

        // Prepare bulk insert documents
        const docsToInsert = normalizedChunk.map((item, idx) => {
          const pred = predictions[idx];

          if (pred.prediction === "Customer Will Churn") churnCount++;
          if (pred.risk_level === "High") highRisk++;
          else if (pred.risk_level === "Medium") mediumRisk++;
          else lowRisk++;

          return {
            batch_id: jobId,
            customer_number: item.customerNo,
            input_data: item.customerData,
            prediction: pred.prediction,
            probability: pred.probability,
            risk_level: pred.risk_level,
            top_features: pred.top_features || [],
          };
        });

        // High performance bulk write
        await BatchPredictionResult.insertMany(docsToInsert, { ordered: false });

        processed += chunkSlice.length;

        // Update incremental progress
        await BatchJob.findByIdAndUpdate(jobId, {
          processed_records: processed,
          summary: {
            churn_count: churnCount,
            stay_count: processed - churnCount,
            high_risk: highRisk,
            medium_risk: mediumRisk,
            low_risk: lowRisk,
          },
        });
      }

      // Mark batch job COMPLETED
      await BatchJob.findByIdAndUpdate(jobId, {
        status: "COMPLETED",
        processed_records: total,
        completed_at: new Date(),
        summary: {
          churn_count: churnCount,
          stay_count: total - churnCount,
          high_risk: highRisk,
          medium_risk: mediumRisk,
          low_risk: lowRisk,
        },
      });

      logger.info(`Batch processing completed for job ${jobId}. Total records: ${total}`);
    } catch (err) {
      logger.error(`Batch job ${jobId} failed: ${err.message}`);
      await BatchJob.findByIdAndUpdate(jobId, {
        status: "FAILED",
        error: err.message,
        completed_at: new Date(),
      });
    }
  },
};
