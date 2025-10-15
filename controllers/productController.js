import { v2 as cloundinary } from "cloudinary";
import productModel from "../models/productModel.js";

//function for add product

const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      sizes,
      bestseller,
      weight,
    } = req.body;

    // ✅ Validate weight
    if (!weight || isNaN(weight) || Number(weight) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing product weight" });
    }

    const image1 = req.files.image1?.[0];
    const image2 = req.files.image2?.[0];
    const image3 = req.files.image3?.[0];
    const image4 = req.files.image4?.[0];
    const image5 = req.files.image5?.[0];

    const images = [image1, image2, image3, image4, image5].filter(
      (item) => item !== undefined
    );

    const imagesUrl = await Promise.all(
      images.map(async (item) => {
        const result = await cloundinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return result.secure_url;
      })
    );

    // ✅ Include weight in productData
    const productData = {
      name,
      description,
      price: Number(price),
      weight: Number(weight), // ✅ Added this line
      category,
      sizes: JSON.parse(sizes),
      bestseller: bestseller === "true" ? true : false,
      image: imagesUrl,
      date: Date.now(),
    };

    console.log("📦 Product Data:", productData);

    const product = new productModel(productData);
    await product.save();

    res.json({ success: true, message: "Product added", product });
  } catch (error) {
    console.log("❌ Error adding product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


//function for list product

const listProduct = async (req, res) => {
  try {
    const products = await productModel.find({});
    res.json({ success: true, products });
  } catch (error) {
    console.log(error);
    res.json({ success: false, mesaage: error.message });
  }
};

//function for remove product

const removeProduct = async (req, res) => {
  try {
    await productModel.findByIdAndDelete(req.body.id);
    res.json({ success: true, mesaage: "Product Removed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, mesaage: error.message });
  }
};

//function for single product info

const singleProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await productModel.findById(productId);
    res.json({ success: true, product });
  } catch (error) {
    console.log(error);
    res.json({ success: false, mesaage: error.message });
  }
};

const idProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product });
  } catch (error) {
    console.log("❌ Error in idProduct:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// function to update a product
const updateProduct = async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      price,
      category,
      sizes,
      bestseller,
      weight,
    } = req.body;

    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ✅ Update fields if provided
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = Number(price);
    if (weight) product.weight = Number(weight);
    if (category) product.category = category;
    if (sizes) product.sizes = Array.isArray(sizes) ? sizes : JSON.parse(sizes);
    if (typeof bestseller !== "undefined") product.bestseller = bestseller === "true" || bestseller === true;

    // ✅ Handle optional new images
    const image1 = req.files?.image1?.[0];
    const image2 = req.files?.image2?.[0];
    const image3 = req.files?.image3?.[0];
    const image4 = req.files?.image4?.[0];
    const image5 = req.files?.image5?.[0];

    const images = [image1, image2, image3, image4, image5].filter(Boolean);

    if (images.length > 0) {
      const uploadedImages = await Promise.all(
        images.map((file) =>
          cloundinary.uploader.upload(file.path, {
            resource_type: "image",
          })
        )
      );
      product.image = uploadedImages.map((img) => img.secure_url);
    }

    await product.save();

    res.json({ success: true, message: "Product updated", product });
  } catch (error) {
    console.log("❌ Error updating product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



export { listProduct, addProduct, removeProduct, singleProduct,idProduct,updateProduct };
