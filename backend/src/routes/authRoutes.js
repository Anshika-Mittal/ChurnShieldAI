import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { uploadProfileImage } from "../middleware/uploadMiddleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.get("/captcha", authController.getCaptcha);
router.post("/signup", authLimiter, authController.signup);
router.post("/verify-otp", authLimiter, authController.verifyOtp);
router.post("/resend-otp", authLimiter, authController.resendOtp);
router.post("/login", authLimiter, authController.login);
router.post("/google-login", authLimiter, authController.googleLogin);
router.post("/logout", authController.logout);

// Protected profile routes
router.get("/profile", authenticateToken, authController.getProfile);
router.put("/profile", authenticateToken, authController.editProfile);
router.post(
  "/profile/image",
  authenticateToken,
  uploadProfileImage.single("file"),
  authController.uploadProfileImage
);
router.delete("/profile/image", authenticateToken, authController.removeProfileImage);

export default router;
