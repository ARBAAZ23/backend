import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: Array,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  sizes: {
    type: Array,
    required: true,
  },
  bestseller: {
    type: Boolean,
    default: false,
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Number,
    required: true,
  },
});

const productModel =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default productModel;
