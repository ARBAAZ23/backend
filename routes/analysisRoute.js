import express from "express";
import orderModel from "../models/orderModel.js";  // make sure you have this
import productModel from "../models/productModel.js";

const analysisRouter = express.Router();

analysisRouter.get("/", async (req, res) => {
  try {
    // Total sales count
    const totalOrders = await orderModel.countDocuments();

    // Total revenue
    const revenueData = await orderModel.aggregate([
      { $match: { status: "Completed" } }, // Only completed orders
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalRevenue = revenueData[0]?.total || 0;

    // Monthly sales graph
    const monthlySales = await orderModel.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          sales: { $sum: "$amount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json({
      success: true,
      totalOrders,
      totalRevenue,
      monthlySales
    });
  } catch (error) {
    console.error("❌ Analysis error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default analysisRouter;
