import express from "express";
import {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  adminLogin,
  forgotPassword, // 🔹 new
  verifyForgotOtp, // 🔹 new
  resetPassword,
  googleLogin,
  deleteAccount,
  getAllUsers // 🔹 new
} from "../controllers/userController.js";
import authUser from "../middleware/auth.js";
import { changePassword, getProfile, updateProfileImg } from "../controllers/profileController.js";
import adminAuth from "../middleware/AdminAuth.js";

const userRouter = express.Router();

//allUser to admin
userRouter.get('/list',adminAuth,getAllUsers)

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

//Profile Route
userRouter.get("/profile", authUser, getProfile);
userRouter.put('/update-img',authUser,updateProfileImg);
userRouter.put('/change-password',authUser,changePassword)

//Delete userAccount
userRouter.delete('/delete',authUser,deleteAccount)
export default userRouter;
