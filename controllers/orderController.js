import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import razorpay from "razorpay";
import nodemailer from "nodemailer";
import { orderConfirmationTemplate } from "../utils/email-template.js"; // ✅ Import template

const currency = "inr";
const deliveryCharge = 10;

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🔹 Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
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
    const emailHtml = orderConfirmationTemplate(user, items, amount, address);

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
        <p><b>Total Amount:</b> ₹${amount}</p>
        ${emailHtml}
      `,
    });

    res.json({ success: true, message: "Order Placed & Email Sent", order: newOrder });
  } catch (error) {
    console.log("Order Error:", error);
    res.json({ success: false, message: error.message });
  }
};

// 🔹 Paypal placeholders
const placeOrderPaypal = async (req, res) => {
  res.json({ success: false, message: "PayPal not implemented yet" });
};

const verfiyPaypal = async (req, res) => {
  res.json({ success: false, message: "PayPal verify not implemented yet" });
};

// 🔹 All orders (admin)
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
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
    console.log(error);
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
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  placeOrder,
  allOrders,
  userOrders,
  updateStatus,
  placeOrderPaypal,
  verfiyPaypal,
};
