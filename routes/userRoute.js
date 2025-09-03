import express from "express";
import {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  adminLogin,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/verify-otp", verifyOtp);
userRouter.post("/resend-otp", resendOtp);
userRouter.post("/login", loginUser);
userRouter.post("/admin", adminLogin);

export default userRouter;
