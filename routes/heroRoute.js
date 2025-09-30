import express from "express";
import upload from "../middleware/multer.js"; // your multer config
import Hero from "../models/heroModel.js";

const heroRouter = express.Router();

// ✅ POST /api/hero
heroRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { title } = req.body;
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    // Remove previous hero entries
    await Hero.deleteMany({});

    const hero = new Hero({ title, mediaUrl: fileUrl });
    await hero.save();

    res.json({ success: true, hero });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ GET /api/hero
heroRouter.get("/", async (req, res) => {
  const hero = await Hero.findOne().sort({ createdAt: -1 });
  res.json(hero);
});

export default heroRouter;
