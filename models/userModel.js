import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    email:{
        type: String,
        required:true,
        unique: true,
    },
    password:{
        type: String,
        required: true
    },
    cartData:{
        type:Object,
        default :{}
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String // OTP itself
    },
    otpExpires: {
        type: Date // Expiration timestamp for the OTP
    },
  },
  { minimize: false }
)

const userModel = mongoose.models.user || mongoose.model('user',userSchema)

export default userModel;

//helooo