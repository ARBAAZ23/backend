import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import validator from "validator";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";

// // --- TEMPORARY DEBUGGING LOGS ---
// console.log("DEBUG: ==========================================");
// console.log("DEBUG: Checking Environment Variables on Server Start");
// console.log("DEBUG: NODE_ENV =", process.env.NODE_ENV);
// console.log("DEBUG: JWT_SECRET =", process.env.JWT_SECRET ? 'SET' : 'NOT SET');
// console.log("DEBUG: SMTP_EMAIL =", process.env.SMTP_EMAIL);
// console.log("DEBUG: SMTP_PASSWORD =", process.env.SMTP_PASSWORD ? 'SET (hidden)' : 'NOT SET');
// console.log("DEBUG: ==========================================");
// // --- END TEMPORARY DEBUGGING LOGS ---
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
  console.log(`DEBUG: Sending email to "${to}" subject: "${subject}"`);
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to,
      subject,
      text,
    });
    console.log(`DEBUG: Email sent successfully! Message ID: ${info.messageId}`);
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    throw new Error(`Failed to send email: ${error.message || "Unknown error"}`);
  }
};

// ================= LOGIN =================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User doesn't exist" });

    if (!user.isVerified) {
      return res.json({ success: false, message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = createToken(user._id);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "Invalid Credentials" });
    }
  } catch (error) {
    console.error("Error in loginUser:", error);
    res.json({ success: false, message: error.message || "Login failed" });
  }
};

// ================= REGISTER =================
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Please enter a valid email" });
    }
    if (password.length < 6) {
      return res.json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      if (!existingUser.isVerified) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        existingUser.otp = otp;
        existingUser.otpExpires = Date.now() + 10 * 60 * 1000;
        await existingUser.save();
        await sendEmail(email, "Verify your account", `Your new OTP is ${otp}.`);
        return res.json({ success: true, message: "New OTP sent.", redirect: "otp", email });
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

    return res.json({ success: true, message: "Registration successful! OTP sent.", redirect: "otp", email });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res.json({ success: false, message: error.message || "Registration failed" });
  }
};

// ================= VERIFY OTP =================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.json({ success: false, message: "OTP expired. Request a new one." });
    }

    if (user.otp !== otp) return res.json({ success: false, message: "Invalid OTP" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = createToken(user._id);
    res.json({ success: true, message: "Account verified", token });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.json({ success: false, message: error.message || "OTP verification failed" });
  }
};

// ================= RESEND OTP =================
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.isVerified) return res.json({ success: false, message: "Already verified." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail(email, "Resend OTP", `Your new OTP is ${otp}.`);
    res.json({ success: true, message: "New OTP sent." });
  } catch (error) {
    console.error("Error in resendOtp:", error);
    res.json({ success: false, message: error.message || "Resend OTP failed" });
  }
};

// ================= ADMIN LOGIN =================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const adminToken = jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1d" });
      res.json({ success: true, token: adminToken });
    } else {
      res.json({ success: false, message: "Invalid Admin Credentials" });
    }
  } catch (error) {
    console.error("Error in adminLogin:", error);
    res.json({ success: false, message: error.message || "Admin login failed" });
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
    res.json({ success: true, message: "OTP sent to email", redirect: "verify-forgot-otp", email });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.json({ success: false, message: error.message || "Forgot password failed" });
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
    if (user.otp !== otp) return res.json({ success: false, message: "Invalid OTP" });

    // Mark OTP verified, but don't log in yet
    user.otp = null;
    user.otpExpires = null;
    user.isOtpVerifiedForReset = true; // custom flag
    await user.save();


    console.log(user);
    
    res.json({ success: true, message: "OTP verified. You can reset password now." });
  } catch (error) {
    console.error("Error in verifyForgotOtp:", error);
    res.json({ success: false, message: error.message || "OTP verification failed" });
  }
};

// ================= RESET PASSWORD =================
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.json({ success: false, message: "Email and new password are required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    if (!user.isOtpVerifiedForReset) {
      return res.json({ success: false, message: "OTP not verified for reset" });
    }

    // hash password with salt
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.isOtpVerifiedForReset = false; // reset flag
    await user.save();

    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.json({ success: false, message: error.message || "Password reset failed" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Check if user exists
    let user = await userModel.findOne({ email });

    if (!user) {
      user = new userModel({
        name,
        email,
        password: "", // Google users don’t need local password
        profilePic: picture,
      });
      await user.save();
    }

    // Generate JWT
    const authToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ success: true, token: authToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Google login failed" });
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
  googleLogin
};
