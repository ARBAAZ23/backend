import mongoose from "mongoose";

const heroSchema = new mongoose.Schema({
  title: { type: String, required: true },
  mediaUrl: { type: String, required: true }, // video or image
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Hero", heroSchema);
