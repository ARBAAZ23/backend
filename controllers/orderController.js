import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import nodemailer from "nodemailer";
import { orderConfirmationTemplate } from "../utils/email-template.js";
import { client, checkoutNodeJssdk } from "../config/paypal.js";
import { generateInvoicePdf } from "../utils/pdf-generator.js";

const currency = "GBP";
const frontendUrl = process.env.FRONTEND_URL;

// ✅ SHIPPING RATES (per kg)
const UK_STANDARD_RATE_PER_KG = 4.99;
const UK_NEXT_DAY_RATE_PER_KG = 8.99;
const INTERNATIONAL_RATE_PER_KG = 9.99;

// ✅ SHIPPING COST CALCULATOR
async function calculateShippingCost(items, country = "UK", shippingMethod = "standard") {
  let totalWeightGrams = 0;

  for (const item of items) {
    const productId = item.id || item.productId || item._id;
    if (!productId) throw new Error("Missing product ID in order item");

    const product = await productModel.findById(productId);
    if (!product) throw new Error(`Product with ID ${productId} not found`);

    // assume weight in grams, fallback to 500g
    const productWeight = product.weight || 500;
    totalWeightGrams += productWeight * (item.quantity || 1);
  }

  // convert grams → kg
  const totalWeightKg = totalWeightGrams / 1000;

  let shippingCost = 0;
  if (country.toLowerCase() === "uk") {
    shippingCost =
      shippingMethod === "next_day"
        ? totalWeightKg * UK_NEXT_DAY_RATE_PER_KG
        : totalWeightKg * UK_STANDARD_RATE_PER_KG;
  } else {
    shippingCost = totalWeightKg * INTERNATIONAL_RATE_PER_KG;
  }

  // ✅ Optional: free shipping over £100
  const subtotal = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  if (subtotal >= 100) shippingCost = 0;

  return Math.round(shippingCost * 100) / 100;
}

// ✅ SMTP SETUP
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

// ✅ COD ORDER
const placeOrder = async (req, res) => {
  try {
    const { userId, items, amount: baseAmount, address, shippingMethod = "standard", country = "UK" } = req.body;

    if (!userId || !items || !items.length) {
      return res.status(400).json({ success: false, message: "Invalid request data" });
    }

    // ✅ Validate products
    for (const item of items) {
      const productId = item._id || item.productId;
      if (!productId) {
        return res.status(400).json({ success: false, message: "Missing product ID in item" });
      }
      const product = await productModel.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product with ID ${productId} not found` });
      }
    }

    // ✅ Calculate shipping + total
    const shippingCost = await calculateShippingCost(items, country, shippingMethod);
    const totalAmount = Number(baseAmount) + shippingCost;

    const orderData = {
      userId,
      items,
      baseAmount,
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

    await userModel.findByIdAndUpdate(userId, { cartData: {} });
    const user = await userModel.findById(userId);

    const emailHtml = await orderConfirmationTemplate(
      user,
      items,
      baseAmount,
      address,
      shippingCost,
      totalAmount
    );

    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: user.email,
      subject: "🛒 Order Confirmation",
      html: emailHtml,
    });

    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `📢 New COD Order from ${user.email}`,
      html: emailHtml,
    });

    return res.json({ success: true, message: "Order placed successfully", order: newOrder });
  } catch (error) {
    console.error("placeOrder Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ PAYPAL ORDER CREATION
const placeOrderPaypal = async (req, res) => {
  try {
    const { userId, items, amount: baseAmount, address, shippingMethod = "standard", country = "UK" } = req.body;

    if (!userId || !items || !items.length) {
      return res.status(400).json({ success: false, message: "Invalid request data" });
    }

    // ✅ Validate products
    for (const item of items) {
      const productId = item.id || item.productId;
      if (!productId) {
        return res.status(400).json({ success: false, message: "Missing product ID in item" });
      }
      const product = await productModel.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product with ID ${productId} not found` });
      }
    }

    // ✅ Calculate shipping + total
    const shippingCost = await calculateShippingCost(items, country, shippingMethod);
    const totalAmount = Number(baseAmount) + shippingCost;

    // ✅ Create PayPal order
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
            currency_code: currency,
            value: totalAmount.toFixed(2),
            breakdown: {
              item_total: { currency_code: currency, value: baseAmount.toFixed(2) },
              shipping: { currency_code: currency, value: shippingCost.toFixed(2) },
            },
          },
        },
      ],
    });

    const order = await client().execute(request);

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

// ✅ PAYPAL VERIFICATION
const verifyPaypal = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const capture = await client().execute(request);

    console.log("✅ PayPal Capture Result:", capture.result.status);

    if (capture.result.status === "COMPLETED") {
      const updatedOrder = await orderModel.findOneAndUpdate(
        { paypalOrderId: orderId },
        { payment: true, status: "Placed" },
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({ success: false, message: "No matching order found" });
      }

      const user = await userModel.findById(updatedOrder.userId);
      await userModel.findByIdAndUpdate(user._id, { cartData: {} });

      const emailHtml = await orderConfirmationTemplate(
        user,
        updatedOrder.items,
        updatedOrder.baseAmount,
        updatedOrder.address,
        updatedOrder.shippingCost,
        updatedOrder.totalAmount
      );

      const invoicePath = await generateInvoicePdf(
        user,
        updatedOrder.items,
        updatedOrder.totalAmount,
        updatedOrder.address,
        updatedOrder._id.toString(),
        updatedOrder.shippingCost
      );

      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: user.email,
        subject: "✅ PayPal Order Confirmed",
        html: emailHtml,
        attachments: [{ filename: `Invoice-${updatedOrder._id}.pdf`, path: invoicePath }],
      });

      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `📢 New PayPal Order from ${user.email}`,
        html: emailHtml,
        attachments: [{ filename: `Invoice-${updatedOrder._id}.pdf`, path: invoicePath }],
      });

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

// ✅ ADMIN: Get all orders
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({}).populate("userId");
    return res.json({ success: true, orders });
  } catch (error) {
    console.error("allOrders Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ USER: Get user's orders
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

// ✅ ADMIN: Update order status
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

const getAllInvoices = async (req, res) => {
  try {
    const invoices = await orderModel
      .find({ payment: true }) // only paid orders
      .populate("userId", "name email") // populate user info
      .sort({ createdAt: -1 });

    const formatted = invoices.map((order) => ({
      _id: order._id,
      user: {
        name: order.userId?.name,
        email: order.userId?.email,
      },
      amount: order.totalAmount,
      createdAt: order.createdAt,
    }));

    res.json({ success: true, invoices: formatted });
  } catch (err) {
    console.error("Error fetching invoices:", err);
    res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
};
const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await orderModel
      .findById(id)
      .populate("userId", "name email") // Get user details
      .lean(); // Optional: make result a plain object

    if (!order || !order.payment) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoiceData = {
      _id: order._id,
      user: {
        name: order.userId?.name,
        email: order.userId?.email,
      },
      items: order.items,
      amount: order.totalAmount,
      shipping: order.shippingCost,
      address: order.address,
      createdAt: order.createdAt,
    };

    res.json({ success: true, invoice: invoiceData });
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ success: false, message: "Failed to fetch invoice" });
  }
};


export { placeOrder, placeOrderPaypal, verifyPaypal, allOrders, userOrders, updateStatus, getAllInvoices,getInvoice };
