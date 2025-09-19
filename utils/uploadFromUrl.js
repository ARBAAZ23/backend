import cloudinary from "../config/cloudinary.js";

export const uploadFromUrl = async (url) => {
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder: "user_profiles",
    });

    console.log("Cloudinary upload success:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw error;
  }
};
