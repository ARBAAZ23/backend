import express from "express";
import {
  placeOrder,
  allOrders,
  userOrders,
  updateStatus,
  placeOrderPaypal,
  verifyPaypal
} from "../controllers/orderController.js";
import adminAuth from "../middleware/AdminAuth.js";
import authUser from "../middleware/auth.js";

const orderRouter = express.Router();

// Admin
orderRouter.post("/list", adminAuth, allOrders);
orderRouter.post("/status", adminAuth, updateStatus);

// COD
orderRouter.post("/place", authUser, placeOrder);

// PayPal
orderRouter.post("/paypal", authUser, placeOrderPaypal);
orderRouter.post("/verify-paypal", authUser, verifyPaypal);

// User
orderRouter.post("/userorders", authUser, userOrders);

export default orderRouter;
