import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  items: { type: Array, required: true },
  baseAmount: { type: Number, required: true },     // amount excluding shipping
  shippingCost: { type: Number, required: true },
  totalAmount: { type: Number, required: true },     // base + shipping
  address: { type: Object, required: true },
  shippingMethod: { type: String, enum: ["standard", "next_day"], default: "standard" },
  country: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, default: false },
  paypalOrderId: { type: String },
  date: { type: Number, required: true },
  status: { type: String, default: "Pending" },
});

const orderModel = mongoose.models.Order || mongoose.model("order", orderSchema);
export default orderModel;
