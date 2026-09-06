import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User } from "../src/models/User.js";
import { generateJWT } from "../src/middleware/authMiddleware.js";
import { s3Service } from "../src/services/s3Service.js";

describe("AWS S3 Profile Image Lifecycle & Validation", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/churn_db_test");
    } catch (err) {}

    const user = await User.create({
      name: "S3 User",
      email: "s3.test@test.com",
      verified: true,
      profile_image: "https://my-bucket.s3.us-east-1.amazonaws.com/avatars/oldavatar123.png",
    });
    userId = String(user._id);
    authToken = generateJWT(user);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: "s3.test@test.com" });
      await mongoose.disconnect();
    } catch (err) {}
  });

  describe("File Validation", () => {
    it("should reject non-image file types", async () => {
      const res = await request(app)
        .post("/api/auth/profile/image")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from("pdf content"), "document.pdf");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Only JPG, JPEG, and PNG");
    });

    it("should reject files exceeding 5MB size limit", async () => {
      // 6MB buffer
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

      const res = await request(app)
        .post("/api/auth/profile/image")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", largeBuffer, "large_image.png");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("exceeds the allowed limit");
    });
  });

  describe("S3 Lifecycle Management & Orphan Cleanup", () => {
    it("should delete old S3 object and upload new image", async () => {
      const deleteSpy = jest.spyOn(s3Service, "deleteFile").mockResolvedValue(true);
      const uploadSpy = jest.spyOn(s3Service, "uploadFile").mockResolvedValue({
        url: "https://my-bucket.s3.us-east-1.amazonaws.com/avatars/newavatar456.png",
        key: "avatars/newavatar456.png",
      });

      const sampleImageBuffer = Buffer.from("fake-png-image-binary-data");

      const res = await request(app)
        .post("/api/auth/profile/image")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", sampleImageBuffer, "avatar.png");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("profile_image");
      expect(res.body.profile_image).toBe(
        "https://my-bucket.s3.us-east-1.amazonaws.com/avatars/newavatar456.png"
      );

      // Verify old avatar was deleted
      expect(deleteSpy).toHaveBeenCalledWith(
        "https://my-bucket.s3.us-east-1.amazonaws.com/avatars/oldavatar123.png"
      );

      // Verify user document in DB has updated profile_image
      const user = await User.findById(userId);
      expect(user.profile_image).toBe(
        "https://my-bucket.s3.us-east-1.amazonaws.com/avatars/newavatar456.png"
      );

      deleteSpy.mockRestore();
      uploadSpy.mockRestore();
    });

    it("should remove profile image and delete object from S3", async () => {
      const deleteSpy = jest.spyOn(s3Service, "deleteFile").mockResolvedValue(true);

      const res = await request(app)
        .delete("/api/auth/profile/image")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("removed successfully");

      const user = await User.findById(userId);
      expect(user.profile_image).toBe("");

      deleteSpy.mockRestore();
    });
  });
});
