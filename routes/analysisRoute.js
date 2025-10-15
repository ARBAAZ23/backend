import express from "express";
import orderModel from "../models/orderModel.js";

const analysisRouter = express.Router();

analysisRouter.get("/", async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // ✅ Total Paid Orders
    const totalPlacedOrders = await orderModel.find({ paymentStatus: "Paid" });
    const totalOrders = totalPlacedOrders.length;

    // ✅ Total Sales
    const salesData = await orderModel.aggregate([
      { $match: { paymentStatus: "Paid", createdAt: { $exists: true } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalSales = salesData[0]?.total || 0;

    // ✅ Monthly Sales
    const monthlySales = await orderModel.aggregate([
      {
        $match: { paymentStatus: "Paid", createdAt: { $exists: true } },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const salesOverTime = monthlySales.map((item) => ({
      month: `${String(item._id.month).padStart(2, "0")}/${item._id.year}`,
      sales: item.total,
    }));

    // ✅ Top Products This Month
    const topProducts = await orderModel.aggregate([
      {
        $match: {
          paymentStatus: "Paid",
          createdAt: { $exists: true },
          $expr: {
            $and: [
              { $eq: [{ $month: "$createdAt" }, currentMonth] },
              { $eq: [{ $year: "$createdAt" }, currentYear] },
            ],
          },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalQuantity: { $sum: "$products.quantity" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.name",
          sales: "$totalQuantity",
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 5 },
    ]);

    // ✅ Final Response
    res.json({
      success: true,
      totalOrders,
      totalSales,
      salesOverTime,
      topProducts,
    });
  } catch (error) {
    console.error("❌ Analysis error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default analysisRouter;
