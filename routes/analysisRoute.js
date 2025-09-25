import express from "express";
import orderModel from "../models/orderModel.js";

const analysisRouter = express.Router();

analysisRouter.get("/", async (req, res) => {
  try {
    // 🟢 Total PAID orders
    const totalPlacedOrders = await orderModel.find({ payment: true });
    const totalOrders = totalPlacedOrders.length;
    // 🟢 Total sales (sum of all PAID order amounts)
    const salesData = await orderModel.aggregate([
      { $match: { payment: true, createdAt: { $exists: true } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalSales = salesData[0]?.total || 0;

    // 🟢 Monthly sales (only PAID orders)
    const monthlySales = await orderModel.aggregate([
      {
        $match: { payment: true, createdAt: { $exists: true } },
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

    // 🟢 Top products of the current month (only PAID orders)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

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

    let response = {
      success: true,
      totalOrders: totalOrders,
      totalSales,
      salesOverTime,
      topProducts,
    };

    console.log(response);

    res.json(response);
  } catch (error) {
    console.error("❌ Analysis error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default analysisRouter;
