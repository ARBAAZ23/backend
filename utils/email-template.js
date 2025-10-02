import productModel from "../models/productModel.js";

export const orderConfirmationTemplate = async (user, items, amount, address) => {
  let productHtml = await Promise.all(
    items.map(async (item) => {
      const product = await productModel.findById(item.id);

      // Extract the size key and quantity
      const sizeKey = Object.keys(item).find(
        (k) => !["id", "name", "image", "_id", "productId"].includes(k)
      );
      const quantity = item[sizeKey] || 1;

      if (!product || typeof product === "string" || !product.name) {
        console.warn("⚠️ Missing or incomplete product details for an item:", item);
        return `
          <tr>
            <td colspan="5" style="padding: 10px; color: red;">⚠️ Product details not available for ID: ${item.id || "Unknown"}</td>
          </tr>
        `;
      }

      const imageUrl =
        Array.isArray(product.image) && product.image.length > 0
          ? product.image[0]
          : "https://via.placeholder.com/50?text=No+Image";

      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px; text-align: center;">
            <img src="${imageUrl}" width="50" alt="${product.name}" />
          </td>
          <td style="padding: 10px;">${product.name}</td>
          <td style="padding: 10px;">${quantity} ${sizeKey ? `(${sizeKey})` : ""}</td>
          <td style="padding: 10px;">£${product.price?.toFixed(2) || "0.00"}</td>
          <td style="padding: 10px;">£${((product.price || 0) * quantity).toFixed(2)}</td>
        </tr>
      `;
    })
  );

  productHtml = productHtml.join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #2a2a2a;">Hello ${address.firstName || user.name || "Customer"},</h2>
      <p style="font-size: 16px;">Thank you for your purchase! We're excited to let you know that your order has been successfully placed.</p>

      <h3 style="color: #444; margin-top: 30px;">🛒 Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; background: #fff;">
        <thead>
          <tr style="background-color: #f2f2f2; text-align: left;">
            <th style="padding: 10px;">Image</th>
            <th style="padding: 10px;">Product</th>
            <th style="padding: 10px;">Quantity</th>
            <th style="padding: 10px;">Price</th>
            <th style="padding: 10px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productHtml}
        </tbody>
      </table>

      <h3 style="text-align: right; margin-top: 20px;">Grand Total: <span style="color: #000;">£${amount.toFixed(2)}</span></h3>

      <h3 style="margin-top: 40px;">📍 Delivery Address</h3>
      <p style="line-height: 1.6;">
        ${address.firstName || ""} ${address.lastName || ""}<br />
        ${address.street}<br />
        ${address.city}, ${address.state}<br />
        ${address.country} - ${address.zipcode}
      </p>

      <p style="font-size: 16px; margin-top: 30px;">📦 You’ll receive another email with tracking information once your order has shipped.</p>

      <p style="margin-top: 40px;">Thank you for shopping with us!<br />— The Panache By Soh Team</p>

      <hr style="margin: 40px 0;" />
      <p style="font-size: 12px; color: #888;">This is an automated message. Please do not reply to this email.</p>
    </div>
  `;
};
