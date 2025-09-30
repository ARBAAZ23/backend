import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

import ConnectDB from "./config/mongodb.js";
import cloudinary from "./config/cloudinary.js";

import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import wishlistRouter from "./routes/wishlistRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import analysisRouter from "./routes/analysisRoute.js";
import heroRouter from "./routes/heroRoute.js";
import aboutRouter from "./routes/aboutRoute.js";

// Helpers for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// App setup
const app = express();
const port = process.env.PORT || 4000;

ConnectDB();
cloudinary; // (if initializing something, call it here)

// Middlewares
app.use(express.json());
app.use(cors("*"));

// Serve uploaded static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API routes
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/hero", heroRouter); // ✅ Correctly mounted
app.use("/api/about",aboutRouter)

app.get("/", (req, res) => {
  res.send("API WORKING");
});

app.listen(port, () => console.log("Server started on PORT: " + port));
