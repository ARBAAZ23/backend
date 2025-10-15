import productModel from "../models/productModel.js";

export const orderConfirmationTemplate = async (user, items, amount, address) => {
  const sizeKeys = ["XS", "S", "M", "L", "XL", "XXL"];

  let productHtml = await Promise.all(
    items.map(async (item) => {
      const productId = item.id || item.productId || item._id;
      const product = await productModel.findById(productId);

      if (!product || typeof product === "string" || !product.name) {
        console.warn("⚠️ Missing or incomplete product details for an item:", item);
        return `
          <tr>
            <td colspan="5" style="padding: 12px; color: red;">⚠️ Product details not available for ID: ${productId || "Unknown"}</td>
          </tr>
        `;
      }

      const sizeDetails = sizeKeys
        .filter((size) => item[size])
        .map((size) => `${size}: ${item[size]}`)
        .join(", ");

      const totalQty = sizeKeys.reduce((sum, size) => sum + (Number(item[size]) || 0), 0) || item.quantity || 1;

      const imageUrl =
        Array.isArray(product.image) && product.image.length > 0
          ? product.image[0]
          : "https://via.placeholder.com/50?text=No+Image";

      const price = product.price || 0;
      const totalPrice = price * totalQty;

      return `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px; text-align: center;">
            <img src="${imageUrl}" width="60" alt="${product.name}" style="border-radius: 4px;" />
          </td>
          <td style="padding: 10px; font-weight: 500;">${product.name}</td>
          <td style="padding: 10px;">${sizeDetails || totalQty}</td>
          <td style="padding: 10px;">£${price.toFixed(2)}</td>
          <td style="padding: 10px;">£${totalPrice.toFixed(2)}</td>
        </tr>
      `;
    })
  );

  productHtml = productHtml.join("");

  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 700px; margin: auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #000; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Panache By Soh</h1>
        <p style="color: #ccc; margin: 5px 0 0;">Order Confirmation</p>
      </div>

      <div style="padding: 30px 20px;">
        <p style="font-size: 16px;">Hello <strong>${address.firstName || user.name || "Customer"}</strong>,</p>
        <p style="font-size: 15px;">Thank you for shopping with us! We’re happy to confirm that we’ve received your order.</p>

        <h3 style="margin-top: 30px; font-size: 18px; border-bottom: 2px solid #eee; padding-bottom: 6px;">🛒 Order Summary</h3>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background-color: #f9f9f9; text-align: left; font-weight: 600; color: #555;">
              <th style="padding: 10px;">Image</th>
              <th style="padding: 10px;">Product</th>
              <th style="padding: 10px;">Size(s)</th>
              <th style="padding: 10px;">Price</th>
              <th style="padding: 10px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${productHtml}
          </tbody>
        </table>

        <h3 style="text-align: right; margin-top: 20px; font-size: 17px;">Grand Total: <span style="color: #000;">£${amount.toFixed(2)}</span></h3>

        <h3 style="margin-top: 40px; font-size: 17px;">📍 Shipping Address</h3>
        <p style="line-height: 1.6; font-size: 15px;">
          ${address.firstName || ""} ${address.lastName || ""}<br />
          ${address.street}<br />
          ${address.city}, ${address.state || ""}<br />
          ${address.country} - ${address.zipcode}
        </p>

        <p style="font-size: 14px; margin-top: 30px; color: #555;">You will receive another email with tracking details once your order is shipped.</p>

        <p style="margin-top: 40px; font-size: 15px;">Warm regards,<br /><strong>Panache By Soh</strong> Team</p>
      </div>

      <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #888;">
        This is an automated email. Please do not reply to this message.<br />
        &copy; ${new Date().getFullYear()} Panache By Soh. All rights reserved.
      </div>
    </div>
  `;
};
