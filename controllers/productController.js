import { v2 as cloundinary } from "cloudinary";
import productModel from "../models/productModel.js";

//function for add product

const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, sizes, bestseller, stock } = req.body;

    const image1 = req.files.image1?.[0];
    const image2 = req.files.image2?.[0];
    const image3 = req.files.image3?.[0];
    const image4 = req.files.image4?.[0];
    const image5 = req.files.image5?.[0];

    const images = [image1, image2, image3, image4, image5].filter(
      (item) => item !== undefined
    );

    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloundinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return result.secure_url;
      })
    );

    const productData = {
      name,
      description,
      price: Number(price),
      category,
      sizes: JSON.parse(sizes),
      bestseller: bestseller === "true" ? true : false,
      stock: Number(stock) || 0,   // ✅ save stock value
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
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
0

export { listProduct, addProduct, removeProduct, singleProduct,idProduct };
