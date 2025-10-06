// orderController.js

import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import razorpay from "razorpay";
import nodemailer from "nodemailer";
import { orderConfirmationTemplate } from "../utils/email-template.js";
import { client, checkoutNodeJssdk } from "../config/paypal.js";
import { generateInvoicePdf } from "../utils/pdf-generator.js";

const currency = "GBP";
// You can adjust base rates here or make them configurable
const UK_STANDARD_RATE_PER_KG = 4.99;
const UK_NEXT_DAY_RATE_PER_KG = 8.99;
const INTERNATIONAL_RATE_PER_KG = 9.99;

const frontendUrl = process.env.FRONTEND_URL;

// Razorpay setup (if needed)
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Nodemailer setup (Gmail or other SMTP)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Error:", error);
  } else {
    console.log("✅ SMTP server ready to send emails");
  }
});

// Helper to calculate shipping cost
async function calculateShippingCost(items, country, shippingMethod) {
  // Calculate total weight in kg (assuming product.weight is in kg)
  let totalWeight = 0;
  for (const item of items) {
    const product = await productModel.findById(item._id);
    if (!product) {
      throw new Error(`Product with ID ${item._id} not found`);
    }
    // product.weight should be defined
    totalWeight += (product.weight || 0) * (item.quantity || 1);
  }

  let shippingCost = 0;

  if (country.toLowerCase() === "uk") {
    if (shippingMethod === "next_day") {
      shippingCost = totalWeight * UK_NEXT_DAY_RATE_PER_KG;
    } else {
      // default or "standard"
      shippingCost = totalWeight * UK_STANDARD_RATE_PER_KG;
    }
  } else {
    // International
    shippingCost = totalWeight * INTERNATIONAL_RATE_PER_KG;
  }

  // Optionally, you may want to enforce minimum shipping cost
  // e.g. shippingCost = Math.max(shippingCost, someMinimum);

  // Round to 2 decimals
  shippingCost = Math.round(shippingCost * 100) / 100;

  return shippingCost;
}

// COD order
const placeOrder = async (req, res) => {
  try {
    const {
      userId,
      items,
      amount: baseAmount,
      address,
      shippingMethod = "standard",
      country = "UK",
    } = req.body;

    if (!userId || !items || !items.length) {
      return res.status(400).json({ success: false, message: "Invalid request data" });
    }

    // 1. Check stock availability
    for (const item of items) {
      const product = await productModel.findById(item._id);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      if (product.stock < (item.quantity || 1)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}`,
        });
      }
    }

    // 2. Calculate shipping cost
    const shippingCost = await calculateShippingCost(items, country, shippingMethod);

    // 3. Compute total amount (base + shipping)
    const totalAmount = Number(baseAmount) + shippingCost;

    // 4. Create and save order
    const orderData = {
      userId,
      items,
      baseAmount,        // the amount for products before shipping
      shippingCost,
      totalAmount,
      address,
      shippingMethod,
      country,
      paymentMethod: "COD",
      payment: false,
      date: Date.now(),
      status: "Placed",
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    // 5. Deduct stock
    for (const item of items) {
      await productModel.findByIdAndUpdate(
        item._id,
        { $inc: { stock: -(item.quantity || 1) } }
      );
    }

    // 6. Clear user cart
    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    // 7. Get user details
    const user = await userModel.findById(userId);

    // 8. Email content
    const emailHtml = await orderConfirmationTemplate(
      user,
      items,
      baseAmount,
      address,
      shippingCost,    // include shipping cost
      totalAmount
    );

    // 9. Send email to user
    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: user.email,
      subject: "🛒 Order Confirmation",
      html: emailHtml,
    });

    // 10. Email to admin
    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `📢 New Order from ${user.email}`,
      html: `
        <h2>New Order Received</h2>
        <p><b>User:</b> ${user.email}</p>
        <p><b>Base Amount:</b> £${baseAmount.toFixed(2)}</p>
        <p><b>Shipping Cost:</b> £${shippingCost.toFixed(2)}</p>
        <p><b>Total:</b> £${totalAmount.toFixed(2)}</p>
        ${emailHtml}
      `,
    });

    return res.json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("placeOrder Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PayPal order creation
const placeOrderPaypal = async (req, res) => {
  try {
    const {
      userId,
      items,
      amount: baseAmount,
      address,
      shippingMethod = "standard",
      country = "UK",
    } = req.body;

    if (!userId || !items || !items.length) {
      return res.status(400).json({ success: false, message: "Invalid request data" });
    }

    // Check stock availability
    for (const item of items) {
      const product = await productModel.findById(item._id);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      if (product.stock < (item.quantity || 1)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}`,
        });
      }
    }

    // Calculate shipping cost
    const shippingCost = await calculateShippingCost(items, country, shippingMethod);

    const totalAmount = Number(baseAmount) + shippingCost;

    // Create PayPal order
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      application_context: {
        return_url: `${frontendUrl}/payment-success`,
        cancel_url: `${frontendUrl}/payment-cancelled`,
        brand_name: "YourStore",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
      },
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: totalAmount.toFixed(2),
          },
        },
      ],
    });

    const order = await client().execute(request);

    // Save order in DB (status pending)
    const newOrder = new orderModel({
      userId,
      items,
      baseAmount,
      shippingCost,
      totalAmount,
      address,
      shippingMethod,
      country,
      paymentMethod: "PayPal",
      payment: false,
      paypalOrderId: order.result.id,
      date: Date.now(),
      status: "Pending",
    });
    await newOrder.save();

    return res.json({
      success: true,
      id: order.result.id,
      approvalUrl: order.result.links.find((link) => link.rel === "approve").href,
    });
  } catch (error) {
    console.error("placeOrderPaypal Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PayPal verification / capture
const verifyPaypal = async (req, res) => {
  try {
    const { orderId, userId } = req.body;

    if (!orderId || !userId) {
      return res.status(400).json({ success: false, message: "orderId & userId are required" });
    }

    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client().execute(request);

    if (capture.result.status === "COMPLETED") {
      // Update order in DB
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

      // Deduct stock
      for (const item of updatedOrder.items) {
        await productModel.findByIdAndUpdate(
          item._id,
          { $inc: { stock: -(item.quantity || 1) } }
        );
      }

      // Clear user cart
      const user = await userModel.findById(userId);
      await userModel.findByIdAndUpdate(userId, { cartData: {} });

      // Generate email content
      const emailHtml = await orderConfirmationTemplate(
        user,
        updatedOrder.items,
        updatedOrder.baseAmount,
        updatedOrder.address,
        updatedOrder.shippingCost,
        updatedOrder.totalAmount
      );

      // Generate invoice PDF
      const invoicePath = await generateInvoicePdf(
        user,
        updatedOrder.items,
        updatedOrder.totalAmount,
        updatedOrder.address,
        updatedOrder._id.toString()
      );

      // Email user with invoice
      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: user.email,
        subject: "✅ PayPal Order Confirmed",
        html: emailHtml,
        attachments: [
          {
            filename: `Invoice-${updatedOrder._id}.pdf`,
            path: invoicePath,
          },
        ],
      });

      // Email admin with invoice
      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `📢 New PayPal Order from ${user.email}`,
        html: emailHtml,
        attachments: [
          {
            filename: `Invoice-${updatedOrder._id}.pdf`,
            path: invoicePath,
          },
        ],
      });

      // (Optional) you may clean up invoice file if you want after some time

      return res.json({
        success: true,
        message: "Payment verified & order placed",
        order: updatedOrder,
      });
    } else {
      return res.status(400).json({ success: false, message: "Payment not completed" });
    }
  } catch (error) {
    console.error("verifyPaypal Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: fetch all orders
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({}).populate("userId");
    return res.json({ success: true, orders });
  } catch (error) {
    console.error("allOrders Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Orders for a particular user
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    return res.json({ success: true, orders });
  } catch (error) {
    console.error("userOrders Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update order status (admin)
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    return res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.error("updateStatus Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export {
  placeOrder,
  placeOrderPaypal,
  verifyPaypal,
  allOrders,
  userOrders,
  updateStatus,
};
