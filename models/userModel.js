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
    },
    profilePic: {
      type: String,
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
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    isOtpVerifiedForReset: {
      type: Boolean,
      default: false,
    },

    // ✅ Address field
    address: {
      street: { type: String },
      city: { type: String },
      pincode: { type: String },
    },

    // ✅ Wishlist field
    wishlist: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        size: { type: String, default: null },
      },
    ],
  },
  { minimize: false, timestamps: true }
);

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
