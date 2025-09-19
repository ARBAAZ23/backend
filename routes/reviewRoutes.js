import express from "express";
import Review from "../models/reviewModel.js";
import authUser from "../middleware/auth.js";

const reviewRouter = express.Router();

// ✅ Get all reviews for a product
reviewRouter.get("/:productId", async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate("user", "name") // only bring user name
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews", error });
  }
});

// ✅ Add new review (requires login)
reviewRouter.post("/", authUser, async (req, res) => {
  try {
    const { rating, comment, product } = req.body;

    if (!rating || !comment || !product) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newReview = new Review({
      product,
      user: req.user._id, // from middleware
      rating,
      comment,
    });

    await newReview.save();

    const populatedReview = await newReview.populate("user", "name");

    res.status(201).json(populatedReview);
  } catch (error) {
    res.status(500).json({ message: "Failed to add review", error });
  }
});

export default reviewRouter;
