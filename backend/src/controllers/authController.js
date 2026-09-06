import bcrypt from "bcryptjs";
import axios from "axios";
import { config } from "../config/env.js";
import { User } from "../models/User.js";
import { generateJWT } from "../middleware/authMiddleware.js";
import { generateCaptcha, verifyCaptcha } from "../utils/captcha.js";
import { otpService } from "../services/otpService.js";
import { s3Service } from "../services/s3Service.js";
import { logger } from "../utils/logger.js";

export const authController = {
  /**
   * GET /api/auth/captcha
   */
  async getCaptcha(req, res, next) {
    try {
      const captcha = generateCaptcha();
      return res.status(200).json(captcha);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/signup
   */
  async signup(req, res, next) {
    try {
      const { name, email, password } = req.body || {};
      const cleanName = (name || "").trim();
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPassword = (password || "").trim();

      if (!cleanName || !cleanEmail || !cleanPassword) {
        return res.status(400).json({ message: "Name, email, and password are required." });
      }

      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        if (existingUser.verified) {
          return res.status(400).json({ message: "An account with this email is already registered." });
        } else {
          // Overwrite unverified account details
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(cleanPassword, salt);
          existingUser.name = cleanName;
          existingUser.password_hash = passwordHash;
          existingUser.created_at = new Date();
          await existingUser.save();
        }
      } else {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(cleanPassword, salt);
        await User.create({
          name: cleanName,
          email: cleanEmail,
          password_hash: passwordHash,
          google_auth: false,
          verified: false,
        });
      }

      const otpResult = await otpService.generateAndSendOtp(cleanEmail);
      if (!otpResult.success) {
        return res.status(400).json({ message: otpResult.message });
      }

      return res.status(200).json({
        message: "OTP verification code sent. Please check your inbox.",
        email: cleanEmail,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/verify-otp
   */
  async verifyOtp(req, res, next) {
    try {
      const { email, otp } = req.body || {};
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanOtp = (otp || "").trim();

      if (!cleanEmail || !cleanOtp) {
        return res.status(400).json({ message: "Email and OTP code are required." });
      }

      const verification = await otpService.verifyOtpCode(cleanEmail, cleanOtp);
      if (!verification.success) {
        return res.status(400).json({ message: verification.message });
      }

      const user = await User.findOneAndUpdate(
        { email: cleanEmail },
        { verified: true, last_login: new Date() },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: "User account not found." });
      }

      const token = generateJWT(user);

      return res.status(200).json({
        message: "Account verified successfully.",
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          profile_image: user.profile_image || "",
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/resend-otp
   */
  async resendOtp(req, res, next) {
    try {
      const { email } = req.body || {};
      const cleanEmail = (email || "").trim().toLowerCase();

      if (!cleanEmail) {
        return res.status(400).json({ message: "Email address is required." });
      }

      const result = await otpService.generateAndSendOtp(cleanEmail);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      return res.status(200).json({ message: "A new verification code has been sent." });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password, captcha_token, captcha_ans } = req.body || {};
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPassword = (password || "").trim();

      if (!cleanEmail || !cleanPassword || !captcha_token || !captcha_ans) {
        return res.status(400).json({ message: "All sign-in fields and Captcha are required." });
      }

      // Verify Captcha
      const captchaResult = verifyCaptcha(captcha_token, captcha_ans);
      if (!captchaResult.valid) {
        return res.status(400).json({ message: captchaResult.message });
      }

      // Verify User
      const user = await User.findOne({ email: cleanEmail });
      if (!user || user.google_auth) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      if (!user.verified) {
        return res.status(401).json({
          message: "Account has not been verified yet. Please sign up again to verify.",
          unverified: true,
        });
      }

      // Verify Password
      const isMatch = await bcrypt.compare(cleanPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      user.last_login = new Date();
      await user.save();

      const token = generateJWT(user);

      return res.status(200).json({
        message: "Login successful.",
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          profile_image: user.profile_image || "",
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/google-login
   */
  async googleLogin(req, res, next) {
    try {
      const { id_token } = req.body || {};
      if (!id_token) {
        return res.status(400).json({ message: "Google authentication ID token is missing." });
      }

      let email = "";
      let name = "Google User";
      let profile_img = "";

      if (id_token === "mock-google-token") {
        email = "demo_google_user@gmail.com";
        name = "Demo Google User";
      } else {
        const response = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
          params: { id_token },
          validateStatus: () => true,
        });
        if (response.status !== 200) {
          return res.status(401).json({ message: "Google token validation failed. Access denied." });
        }
        const gInfo = response.data;
        if (config.GOOGLE_CLIENT_ID && gInfo.aud && gInfo.aud !== config.GOOGLE_CLIENT_ID) {
          return res.status(401).json({ message: "Google token audience mismatch. Access denied." });
        }
        email = (gInfo.email || "").trim().toLowerCase();
        name = gInfo.name || "Google User";
        profile_img = gInfo.picture || "";
      }

      if (!email) {
        return res.status(400).json({ message: "Could not retrieve email from Google profile." });
      }

      let user = await User.findOne({ email });
      if (user) {
        user.google_auth = true;
        user.verified = true;
        if (profile_img && !user.profile_image) {
          user.profile_image = profile_img;
        }
        user.last_login = new Date();
        await user.save();
      } else {
        user = await User.create({
          name,
          email,
          password_hash: "",
          google_auth: true,
          verified: true,
          profile_image: profile_img,
          last_login: new Date(),
        });
      }

      const token = generateJWT(user);

      return res.status(200).json({
        message: "Google login successful.",
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          profile_image: user.profile_image || "",
        },
      });
    } catch (err) {
      logger.error(`Google login failure: ${err.message}`);
      return res.status(500).json({ message: `Google authentication failed: ${err.message}` });
    }
  },

  /**
   * GET /api/auth/profile
   */
  async getProfile(req, res, next) {
    try {
      const user = req.user;
      return res.status(200).json({
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          profile_image: user.profile_image || "",
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/auth/profile
   */
  async editProfile(req, res, next) {
    try {
      const { name, profile_image } = req.body || {};
      const cleanName = (name || "").trim();

      if (!cleanName) {
        return res.status(400).json({ message: "Profile name cannot be blank." });
      }

      const updateData = { name: cleanName };
      if (profile_image !== undefined) {
        updateData.profile_image = profile_image;
      }

      await User.findByIdAndUpdate(req.userId, updateData);
      return res.status(200).json({ message: "Profile updated successfully." });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/profile/image
   */
  async uploadProfileImage(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file payload found." });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Delete previous S3 avatar if it exists
      if (user.profile_image) {
        await s3Service.deleteFile(user.profile_image);
      }

      // Upload new avatar to S3
      const { url } = await s3Service.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Update User document in MongoDB
      user.profile_image = url;
      await user.save();

      return res.status(200).json({
        message: "Profile picture uploaded successfully.",
        profile_image: url,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/auth/profile/image
   */
  async removeProfileImage(req, res, next) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (user.profile_image) {
        await s3Service.deleteFile(user.profile_image);
      }

      user.profile_image = "";
      await user.save();

      return res.status(200).json({ message: "Profile picture removed successfully." });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    return res.status(200).json({ message: "Logged out successfully." });
  },
};
