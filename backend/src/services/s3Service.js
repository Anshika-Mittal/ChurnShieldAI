import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localUploadDir = path.resolve(__dirname, "../../uploads/avatars");

let s3Client = null;

function getClient() {
  if (!s3Client) {
    if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
      logger.warn("AWS S3 credentials not configured in environment.");
      return null;
    }
    s3Client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

async function saveLocally(fileBuffer, originalFilename) {
  await fs.mkdir(localUploadDir, { recursive: true });
  const ext = path.extname(originalFilename).toLowerCase() || ".png";
  const filename = `${uuidv4().replace(/-/g, "")}${ext}`;
  await fs.writeFile(path.join(localUploadDir, filename), fileBuffer);
  const url = `${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/uploads/avatars/${filename}`;
  logger.info(`Profile image stored locally: ${url}`);
  return { url, key: `avatars/${filename}` };
}

export const s3Service = {
  /**
   * Upload file buffer to S3 (or local uploads/ when AWS is not configured).
   */
  async uploadFile(fileBuffer, originalFilename, contentType) {
    const client = getClient();
    if (!client || !config.AWS_S3_BUCKET) {
      logger.warn("AWS S3 is not configured. Saving profile image locally under /uploads/avatars.");
      return saveLocally(fileBuffer, originalFilename);
    }

    const ext = path.extname(originalFilename).toLowerCase();
    const uniqueKey = `avatars/${uuidv4().replace(/-/g, "")}${ext}`;

    const command = new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: contentType,
    });

    try {
      await client.send(command);
      const url = `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${uniqueKey}`;
      logger.info(`File uploaded successfully to S3: ${url}`);
      return { url, key: uniqueKey };
    } catch (err) {
      logger.error(`AWS S3 upload failed: ${err.message}`);
      throw new Error(`AWS S3 upload failed: ${err.message}`);
    }
  },

  /**
   * Extract key from URL and delete from S3.
   */
  async deleteFile(imageUrl) {
    if (!imageUrl) return false;

    if (imageUrl.includes("/uploads/avatars/")) {
      try {
        const filename = imageUrl.split("/uploads/avatars/")[1];
        if (filename) {
          await fs.unlink(path.join(localUploadDir, filename));
          logger.info(`Deleted local avatar: ${filename}`);
        }
      } catch (err) {
        logger.warn(`Local avatar delete skipped: ${err.message}`);
      }
      return true;
    }

    const client = getClient();
    if (!client || !config.AWS_S3_BUCKET) {
      logger.warn("AWS S3 not configured. Skipping S3 deletion.");
      return false;
    }

    try {
      if (!imageUrl.includes("s3") || !imageUrl.includes(".amazonaws.com")) {
        return false;
      }

      let key = "";
      if (imageUrl.includes("avatars/")) {
        key = "avatars/" + imageUrl.split("avatars/")[1];
      } else {
        const parts = imageUrl.split(".amazonaws.com/");
        if (parts.length > 1) {
          key = parts[1];
        } else {
          return false;
        }
      }

      const command = new DeleteObjectCommand({
        Bucket: config.AWS_S3_BUCKET,
        Key: key,
      });

      await client.send(command);
      logger.info(`Successfully deleted S3 object: ${key}`);
      return true;
    } catch (err) {
      logger.error(`Failed to delete S3 object for url ${imageUrl}: ${err.message}`);
      return false;
    }
  },
};
