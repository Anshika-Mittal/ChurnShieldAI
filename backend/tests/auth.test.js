import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.js";
import { OtpVerification } from "../src/models/OtpVerification.js";
import { generateCaptcha, verifyCaptcha } from "../src/utils/captcha.js";

describe("Authentication & Authorization API", () => {
  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/churn_db_test");
    } catch (err) {
      console.warn("Test DB connection notice:", err.message);
    }
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test\.com$/ });
      await OtpVerification.deleteMany({ email: /@test\.com$/ });
      await mongoose.disconnect();
    } catch (err) {}
  });

  describe("Captcha Unit & Integration", () => {
    it("should generate a valid arithmetic captcha challenge", () => {
      const captcha = generateCaptcha();
      expect(captcha).toHaveProperty("question");
      expect(captcha).toHaveProperty("captcha_token");
      expect(captcha.question).toMatch(/What is \d \+ \d\?/);
    });

    it("should verify correct captcha answer", () => {
      const captcha = generateCaptcha();
      const match = captcha.question.match(/What is (\d) \+ (\d)\?/);
      const ans = String(parseInt(match[1], 10) + parseInt(match[2], 10));

      const result = verifyCaptcha(captcha.captcha_token, ans);
      expect(result.valid).toBe(true);
    });

    it("should reject incorrect captcha answer", () => {
      const captcha = generateCaptcha();
      const result = verifyCaptcha(captcha.captcha_token, "999");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Incorrect Captcha");
    });
  });

  describe("Signup & OTP Workflow", () => {
    const testEmail = "john.doe@test.com";

    beforeEach(async () => {
      await User.deleteMany({ email: testEmail });
      await OtpVerification.deleteMany({ email: testEmail });
    });

    it("should register unverified user and generate OTP", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "John Doe",
          email: testEmail,
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("OTP verification code sent");

      const user = await User.findOne({ email: testEmail });
      expect(user).not.toBeNull();
      expect(user.verified).toBe(false);

      const isPasswordHashed = await bcrypt.compare("SecurePassword123!", user.password_hash);
      expect(isPasswordHashed).toBe(true);

      const otpDoc = await OtpVerification.findOne({ email: testEmail });
      expect(otpDoc).not.toBeNull();
      expect(otpDoc.otp).toHaveLength(6);
    });

    it("should verify OTP and activate account returning JWT token", async () => {
      // Create user and OTP
      await request(app).post("/api/auth/signup").send({
        name: "John Doe",
        email: testEmail,
        password: "SecurePassword123!",
      });

      const otpDoc = await OtpVerification.findOne({ email: testEmail });

      const verifyRes = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: testEmail,
          otp: otpDoc.otp,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty("token");
      expect(verifyRes.body.user.email).toBe(testEmail);

      const updatedUser = await User.findOne({ email: testEmail });
      expect(updatedUser.verified).toBe(true);
    });

    it("should reject invalid OTP code", async () => {
      await request(app).post("/api/auth/signup").send({
        name: "John Doe",
        email: testEmail,
        password: "SecurePassword123!",
      });

      const verifyRes = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: testEmail,
          otp: "000000",
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.message).toContain("Invalid verification code");
    });
  });

  describe("Login Workflow", () => {
    const testEmail = "login.user@test.com";
    const password = "ValidPassword123!";

    beforeAll(async () => {
      await User.deleteMany({ email: testEmail });
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await User.create({
        name: "Login User",
        email: testEmail,
        password_hash: passwordHash,
        verified: true,
      });
    });

    it("should login verified user with correct credentials and captcha", async () => {
      const captcha = generateCaptcha();
      const match = captcha.question.match(/What is (\d) \+ (\d)\?/);
      const ans = String(parseInt(match[1], 10) + parseInt(match[2], 10));

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testEmail,
          password: password,
          captcha_token: captcha.captcha_token,
          captcha_ans: ans,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(testEmail);
    });

    it("should reject login with wrong password", async () => {
      const captcha = generateCaptcha();
      const match = captcha.question.match(/What is (\d) \+ (\d)\?/);
      const ans = String(parseInt(match[1], 10) + parseInt(match[2], 10));

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testEmail,
          password: "WrongPassword!",
          captcha_token: captcha.captcha_token,
          captcha_ans: ans,
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid email or password");
    });

    it("should reject unverified user login", async () => {
      const unverifiedEmail = "unverified@test.com";
      await User.deleteMany({ email: unverifiedEmail });
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await User.create({
        name: "Unverified User",
        email: unverifiedEmail,
        password_hash: passwordHash,
        verified: false,
      });

      const captcha = generateCaptcha();
      const match = captcha.question.match(/What is (\d) \+ (\d)\?/);
      const ans = String(parseInt(match[1], 10) + parseInt(match[2], 10));

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: unverifiedEmail,
          password: password,
          captcha_token: captcha.captcha_token,
          captcha_ans: ans,
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("unverified", true);
    });
  });

  describe("Google Authentication", () => {
    it("should authenticate mock Google ID token successfully", async () => {
      const res = await request(app)
        .post("/api/auth/google-login")
        .send({ id_token: "mock-google-token" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe("demo_google_user@gmail.com");
    });
  });
});
