// controllers/userController.js
import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import validator from "validator";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import { uploadFromUrl } from "../utils/uploadFromUrl.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Helper function to send email
const sendEmail = async (to, subject, text) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to,
      subject,
      text,
    });
    console.log(`Email sent: ${info.messageId}`);
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    throw new Error(error.message || "Failed to send email");
  }
};

// ================= LOGIN =================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    if (!user.isVerified) {
      return res.json({
        success: false,
        message: "Please verify your email first",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }

    const token = createToken(user._id);

    // Prepare user object to send (exclude sensitive fields)
    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || null,
      phone: user.phone || null,
      role: user.role || "user",
    };

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Error in loginUser:", error);
    return res.json({ success: false, message: error.message || "Login failed" });
  }
};

// ================= REGISTER =================
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email",
      });
    }
    if (!password || password.length < 6) {
      return res.json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      // If user exists but not verified -> resend OTP
      if (!existingUser.isVerified) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        existingUser.otp = otp;
        existingUser.otpExpires = Date.now() + 10 * 60 * 1000;
        await existingUser.save();
        await sendEmail(email, "Verify your account", `Your new OTP is ${otp}.`);
        return res.json({
          success: true,
          message: "New OTP sent.",
          redirect: "otp",
          email,
        });
      }
      return res.json({ success: false, message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      otp,
      otpExpires,
    });

    await newUser.save();
    await sendEmail(email, "Verify your account", `Your OTP is ${otp}.`);

    return res.json({
      success: true,
      message: "Registration successful! OTP sent.",
      redirect: "otp",
      email,
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

// ================= VERIFY OTP =================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.json({
        success: false,
        message: "OTP expired. Request a new one.",
      });
    }

    if (user.otp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = createToken(user._id);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || null,
      phone: user.phone || null,
      role: user.role || "user",
    };

    return res.json({
      success: true,
      message: "Account verified",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    return res.json({
      success: false,
      message: error.message || "OTP verification failed",
    });
  }
};

// ================= RESEND OTP =================
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.isVerified)
      return res.json({ success: false, message: "Already verified." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail(email, "Resend OTP", `Your new OTP is ${otp}.`);
    return res.json({ success: true, message: "New OTP sent." });
  } catch (error) {
    console.error("Error in resendOtp:", error);
    return res.json({ success: false, message: error.message || "Resend OTP failed" });
  }
};

// ================= ADMIN LOGIN =================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const adminToken = jwt.sign(
        { email, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      return res.json({ success: true, token: adminToken });
    } else {
      return res.json({ success: false, message: "Invalid Admin Credentials" });
    }
  } catch (error) {
    console.error("Error in adminLogin:", error);
    return res.json({
      success: false,
      message: error.message || "Admin login failed",
    });
  }
};

// ================= FORGOT PASSWORD =================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail(email, "Password Reset OTP", `Your password reset OTP is ${otp}.`);
    return res.json({
      success: true,
      message: "OTP sent to email",
      redirect: "verify-forgot-otp",
      email,
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return res.json({
      success: false,
      message: error.message || "Forgot password failed",
    });
  }
};

// ================= VERIFY FORGOT PASSWORD OTP =================
const verifyForgotOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }
    if (user.otp !== otp)
      return res.json({ success: false, message: "Invalid OTP" });

    // Mark OTP verified for reset
    user.otp = null;
    user.otpExpires = null;
    user.isOtpVerifiedForReset = true;
    await user.save();

    return res.json({
      success: true,
      message: "OTP verified. You can reset password now.",
    });
  } catch (error) {
    console.error("Error in verifyForgotOtp:", error);
    return res.json({
      success: false,
      message: error.message || "OTP verification failed",
    });
  }
};

// ================= RESET PASSWORD =================
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.json({
        success: false,
        message: "Email and new password are required",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    if (!user.isOtpVerifiedForReset) {
      return res.json({
        success: false,
        message: "OTP not verified for reset",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.isOtpVerifiedForReset = false;
    await user.save();

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res.json({
      success: false,
      message: error.message || "Password reset failed",
    });
  }
};

// ================= GOOGLE LOGIN =================
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token required" });

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await userModel.findOne({ email });

    if (!user) {
      // Upload Google picture to Cloudinary (or your storage) if you have that util
      let cloudPic = null;
      try {
        if (picture) cloudPic = await uploadFromUrl(picture);
      } catch (err) {
        console.warn("Could not upload Google picture:", err.message);
      }

      user = new userModel({
        name,
        email,
        password: "", // Google users don't need local password
        profilePic: cloudPic,
        isVerified: true, // mark verified since Google provided the email
      });

      await user.save();
    }

    const authToken = createToken(user._id);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || null,
      phone: user.phone || null,
      role: user.role || "user",
    };

    return res.json({
      success: true,
      message: "Google login successful",
      token: authToken,
      user: safeUser,
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ success: false, message: "Google login failed" });
  }
};

// ================= DELETE ACCOUNT =================
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await userModel.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================= GET ALL USERS =================
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}, "name email phone profilePic role"); // only return safe fields
    return res.json({ success: true, users });
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.json({ success: false, message: error.message || "Failed to fetch users" });
  }
};

export {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  adminLogin,
  forgotPassword,
  verifyForgotOtp,
  resetPassword,
  googleLogin,
  deleteAccount,
  getAllUsers,
};
