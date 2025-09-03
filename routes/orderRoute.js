import express from "express";
import {
  placeOrder,
  allOrders,
  userOrders,
  updateStatus,
  placeOrderPaypal,
  verfiyPaypal
} from "../controllers/orderController.js";
import adminAuth from "../middleware/AdminAuth.js";
import authUser from "../middleware/auth.js";

const orderRouter = express.Router();

// Admin routes
orderRouter.post("/list", adminAuth, allOrders);
orderRouter.post("/status", adminAuth, updateStatus);

// Payment routes
orderRouter.post("/place", authUser, placeOrder);
// orderRouter.post("/razorpay", authUser, placeOrderRazorpay);
orderRouter.post("/paypal",authUser,placeOrderPaypal)

// User routes
orderRouter.post("/userorders", authUser, userOrders);

// Verify payment
// orderRouter.post("/verifyRazorpay",authUser,verifyRazorpay);
orderRouter.post('/verfiyPaypal',authUser,verfiyPaypal)

export default orderRouter;
