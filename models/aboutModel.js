import mongoose from "mongoose";

const aboutSchema = new mongoose.Schema(
  {
    mediaUrl: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const About = mongoose.model("About", aboutSchema);

export default About;
