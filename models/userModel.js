import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      // required: true,
    },
    cartData: {
      type: Object,
      default: {},
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String, // OTP itself
    },
    otpExpires: {
      type: Date, // Expiration timestamp for the OTP
    },
    isOtpVerifiedForReset: {
      type: Boolean,
      default: false,
    },

    // ✅ Wishlist field (inside schema object)
    wishlist: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        size: { type: String, default: null },
      },
    ],
  },
  { minimize: false, timestamps: true } // merged options
);

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
