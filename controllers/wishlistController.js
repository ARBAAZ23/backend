import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";

// ✅ Add to Wishlist
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.body.userId; // comes from authUser
    const { productId, size } = req.body;

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const product = await productModel.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const exists = user.wishlist.some(
      (item) => String(item.itemId) === String(productId) && item.size === size
    );
    if (exists) {
      return res.json({ success: true, message: "Already in wishlist" });
    }

    user.wishlist.push({ productId, size });
    await user.save();

    res.json({ success: true, message: "Added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Remove from Wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.body.userId; // comes from authUser
    const { itemId, size } = req.body;

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.wishlist = user.wishlist.filter(
      (item) => !(String(item.itemId) === String(itemId) && item.size === size)
    );
    await user.save();

    res.json({ success: true, message: "Removed from wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Get Wishlist (handle GET safely)
export const getWishlist = async (req, res) => {
  try {
    const userId = req.body?.userId; // ✅ use optional chaining

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID missing from request" });
    }

    const user = await userModel.findById(userId).populate("wishlist.itemId");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, wishlist: user.wishlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Clear Wishlist
export const clearWishlist = async (req, res) => {
  try {
    const userId = req.body.userId; // comes from authUser

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.wishlist = [];
    await user.save();

    res.json({ success: true, message: "Wishlist cleared", wishlist: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
