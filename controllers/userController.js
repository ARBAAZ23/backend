import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import validator from "validator";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

// --- TEMPORARY DEBUGGING LOGS (MOVE TO TOP OF FILE, AFTER IMPORTS) ---
// These logs will show if your .env variables are loaded when the server starts.
console.log("DEBUG: ==========================================");
console.log("DEBUG: Checking Environment Variables on Server Start");
console.log("DEBUG: NODE_ENV =", process.env.NODE_ENV);
console.log("DEBUG: JWT_SECRET =", process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log("DEBUG: SMTP_EMAIL =", process.env.SMTP_EMAIL);
console.log("DEBUG: SMTP_PASSWORD =", process.env.SMTP_PASSWORD ? 'SET (value hidden for security)' : 'NOT SET');
console.log("DEBUG: ==========================================");
// --- END TEMPORARY DEBUGGING LOGS ---


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
  console.log(`DEBUG: Attempting to send email to "${to}" with subject: "${subject}"`);
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to,
      subject,
      text,
    });
    console.log(`DEBUG: Email sent successfully! Message ID: ${info.messageId}`);
    // No need to log SMTP_EMAIL/PASSWORD here, they are checked on server start
  } catch (error) {
    // CRITICAL: Log the full error object here
    console.error(`ERROR: Failed to send email to "${to}" for subject "${subject}".`);
    console.error("FULL EMAIL SENDING ERROR:", error);
    // Re-throw the error so calling functions can handle it and return an appropriate message to the user
    throw new Error(`Failed to send email: ${error.message || "Unknown error"}`);
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
    console.error("Error in loginUser:", error); // Use console.error for errors
    res.json({ success: false, message: error.message || "Login failed" });
  }
};

// ================= REGISTER =================

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate email format
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Please enter a valid email" });
    }
    // Validate password strength (optional, but good practice)
    if (password.length < 6) {
      return res.json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      // If user exists but is not verified, allow them to resend OTP
      if (!existingUser.isVerified) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        existingUser.otp = otp;
        existingUser.otpExpires = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes
        await existingUser.save();
        await sendEmail(email, "Verify your account", `Your new OTP is ${otp}. It expires in 10 minutes.`);
        return res.json({ success: true, message: "User already exists but not verified. New OTP sent.", redirect: "otp", email });
      }
      return res.json({ success: false, message: "User already exists" });
    }

    // Hashing user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword, // Store hashed password
      isVerified: false,
      otp,
      otpExpires,
    });

    await newUser.save();

    // Send OTP
    await sendEmail(email, "Verify your account", `Your OTP is ${otp}. It expires in 10 minutes.`);

    return res.json({ success: true, message: "Registration successful! OTP sent.", redirect: "otp", email });
  } catch (error) {
    console.error("Error in registerUser:", error); // Use console.error for errors
    res.json({ success: false, message: error.message || "Registration failed" });
  }
};

// ================= VERIFY OTP =================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.json({ success: false, message: "User not found" });

    // Check if OTP has expired
    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (user.otp !== otp) return res.json({ success: false, message: "Invalid OTP" });

    user.isVerified = true;
    user.otp = null; // clear OTP
    user.otpExpires = null; // clear expiration
    await user.save();

    // After verification, log the user in immediately
    const token = createToken(user._id);
    res.json({ success: true, message: "Account verified successfully", token });
  } catch (error) {
    console.error("Error in verifyOtp:", error); // Use console.error for errors
    res.json({ success: false, message: error.message || "OTP verification failed" });
  }
};


// ================= RESEND OTP =================
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.isVerified) return res.json({ success: false, message: "Email already verified." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // New OTP valid for 10 minutes
    await user.save();

    await sendEmail(email, "Resend OTP - Verify your email", `Your new OTP is ${otp}. It expires in 10 minutes.`);

    res.json({ success: true, message: "New OTP sent successfully" });
  } catch (error) {
    console.error("Error in resendOtp:", error); // Use console.error for errors
    res.json({ success: false, message: error.message || "Failed to resend OTP" });
  }
};

// ================= ADMIN LOGIN =================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const adminToken = jwt.sign({ email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: "1d" });
      res.json({ success: true, token: adminToken });
    } else {
      res.json({ success: false, message: "Invalid Admin Credentials" });
    }
  } catch (error) {
    console.error("Error in adminLogin:", error); // Use console.error for errors
    res.json({ success: false, message: error.message || "Admin login failed" });
  }
};

export { loginUser, registerUser, verifyOtp, resendOtp, adminLogin };