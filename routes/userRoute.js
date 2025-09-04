import express from "express";
import {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  adminLogin,
  forgotPassword,       // 🔹 new
  verifyForgotOtp,      // 🔹 new
  resetPassword,
  googleLogin        // 🔹 new
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/verify-otp", verifyOtp);
userRouter.post("/resend-otp", resendOtp);
userRouter.post("/login", loginUser);
userRouter.post("/admin", adminLogin);

// 🔹 Forgot Password Routes
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/verify-forgot-otp", verifyForgotOtp);
userRouter.post("/reset-password", resetPassword);

// Google Login 
userRouter.post("/google-login", googleLogin);

export default userRouter;
