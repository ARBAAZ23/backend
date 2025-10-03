// heroRouter.js
import express from "express";
import upload from "../middleware/multer.js";
import Hero from "../models/heroModel.js";

const heroRouter = express.Router();

// ✅ POST /api/hero
heroRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { title } = req.body;

    // ✅ Prefer public BACKEND_URL
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;

    // Remove previous hero
    await Hero.deleteMany({});

    const hero = new Hero({ title, mediaUrl: req.file.filename });
    await hero.save();

    res.json({ success: true, hero });
  } catch (error) {
    console.error("Hero upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ GET /api/hero
heroRouter.get("/", async (req, res) => {
  const hero = await Hero.findOne().sort({ createdAt: -1 });
  res.json(hero);
});

export default heroRouter;
