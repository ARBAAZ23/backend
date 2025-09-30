// routes/aboutRoute.js

import express from "express";
import upload from "../middleware/multer.js"; // multer config
import About from "../models/aboutModel.js";

const aboutRouter = express.Router();

aboutRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const fileUrl = `uploads/${req.file.filename}`; // adjust based on your static serve
    const { description } = req.body;

    await About.deleteMany({}); // only one active about image/text
    const about = new About({ description, mediaUrl: fileUrl });
    await about.save();

    res.json({ success: true, about });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

aboutRouter.get("/", async (req, res) => {
  const about = await About.findOne().sort({ createdAt: -1 });
  res.json(about);
});

export default aboutRouter;
