import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import razorpay from "razorpay";
import nodemailer from "nodemailer";
import { orderConfirmationTemplate } from "../utils/email-template.js";
import { client, checkoutNodeJssdk } from "../config/paypal.js";


const currency = "inr";
const deliveryCharge = 10;

const frontendUrl = process.env.FRONTEND_URL;

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

console.log("SMTP_EMAIL:", process.env.SMTP_EMAIL);
console.log(
  "SMTP_PASSWORD:",
  process.env.SMTP_PASSWORD ? "✅ Loaded" : "❌ Missing"
);

// 🔹 Nodemailer setup (Gmail + App Password)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Optional: test transporter on app start
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Error:", error);
  } else {
    console.log("✅ SMTP server ready to send emails");
  }
});

// ✅ COD order with email
const placeOrder = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    const orderData = {
      userId,
      items,
      amount,
      address,
      paymentMethod: "COD",
      payment: false,
      date: Date.now(),
      status: "Placed",
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    // clear user cart
    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    // get user details
    const user = await userModel.findById(userId);

    // generate email HTML
    const emailHtml = await orderConfirmationTemplate(
      user,
      items,
      amount,
      address
    );

    // send email to user
    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: user.email,
      subject: "🛒 Order Confirmation",
      html: emailHtml,
    });

    // send email to admin
    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `📢 New Order from ${user.email}`,
      html: `
        <h2>New Order Received</h2>
        <p><b>User:</b> ${user.email}</p>
        <p><b>Total Amount:</b> £ ${amount}</p>
        ${emailHtml}
      `,
    });

    res.json({
      success: true,
      message: "Order Placed & Email Sent",
      order: newOrder,
    });
  } catch (error) {
    console.log("Order Error:", error);
    res.json({ success: false, message: error.message });
  }
};

// 🔹 PAYPAL ORDER CREATION
const placeOrderPaypal = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }

    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      application_context: {
        return_url: frontendUrl+"/payment-success",
        cancel_url: frontendUrl+"/payment-cancelled",
        brand_name: "YourStore",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
      },
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: amount.toFixed(2),
          },
        },
      ],
    });

    const order = await client().execute(request);

    // Save order in DB (status pending)
    const newOrder = new orderModel({
      userId,
      items,
      amount,
      address,
      paymentMethod: "PayPal",
      payment: false,
      paypalOrderId: order.result.id,
      date: Date.now(),
      status: "Pending",
    });
    await newOrder.save();

    res.json({
      success: true,
      id: order.result.id,
      approvalUrl: order.result.links.find((link) => link.rel === "approve")
        .href,
    });
  } catch (error) {
    console.log("PayPal Order Error:", error);
    res.json({ success: false, message: error.message });
  }
};

// 🔹 PAYPAL ORDER CAPTURE / VERIFY
const verifyPaypal = async (req, res) => {
  try {
    const { orderId, userId } = req.body;

    if (!orderId || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "orderId & userId are required" });
    }

    // Capture PayPal order
    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client().execute(request);

    if (capture.result.status === "COMPLETED") {
      // Update the order in DB
      const updatedOrder = await orderModel.findOneAndUpdate(
        { paypalOrderId: orderId, userId },
        { payment: true, status: "Placed" },
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({
          success: false,
          message: "No matching order found in database",
        });
      }

      // Fetch user
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const emailHtml = await orderConfirmationTemplate(
        user,
        updatedOrder.items,
        updatedOrder.amount,
        updatedOrder.address
      );

      // Email user
      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: user.email,
        subject: "✅ PayPal Order Confirmed",
        html: emailHtml,
      });

      // Email admin
      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `📢 New PayPal Order from ${user.email}`,
        html: emailHtml,
      });

      res.json({
        success: true,
        message: "Payment verified",
        order: updatedOrder,
      });
    } else {
      res.json({ success: false, message: "Payment not completed" });
    }
  } catch (error) {
    console.error("PayPal Verify Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔹 All orders (admin)
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// 🔹 Orders for user
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    res.json({ success: true, orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// 🔹 Update status
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export {
  placeOrder,
  allOrders,
  userOrders,
  updateStatus,
  placeOrderPaypal,
  verifyPaypal,
};
