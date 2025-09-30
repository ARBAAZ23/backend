import productModel from "../models/productModel.js";

export const orderConfirmationTemplate = async (
  user,
  items,
  amount,
  address
) => {
  let productHtml = await Promise.all(
    items.map(async (item) => {
      // Fetch product details from DB
      const product = await productModel.findById(item.id);
      
      // Extract size (assuming 'M' is the key for size)
      const size = item.M || "";

      // Handle missing product gracefully
      if (!product || typeof product === "string" || !product.name) {
        console.warn(
          "⚠️ Missing or incomplete product details for an item:",
          item
        );
        return `
          <tr>
            <td colspan="5">⚠️ Product details not available for ID: ${
              item.id || "Unknown"
            }</td>
          </tr>
        `;
      }

      // Get product image or fallback
      const imageUrl =
        Array.isArray(product.image) && product.image.length > 0
          ? product.image[0]
          : "https://via.placeholder.com/50?text=No+Image";

      // Build table row HTML with quantity and size
      return `
        <tr>
          <td><img src="${imageUrl}" width="50" alt="${product.name}" /></td>
          <td>${product.name}</td>
          <td>${item.quantity || 1} ${size ? `(${size})` : ""}</td>
          <td>£${product.price || 0}</td>
          <td>£${(product.price || 0) * (item.quantity || 1)}</td>
        </tr>
      `;
    })
  );

  productHtml = productHtml.join("");

  return `
    <h2>Hi ${address.firstName || user.name || "Customer"},</h2>
    <p>🎉 Your order has been placed successfully!</p>

    <h3>🛍 Order Summary</h3>
    <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th>Image</th>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${productHtml}
      </tbody>
    </table>

    <h3>Grand Total: £${amount}</h3>
    <p><b>Delivery Address:</b></p>
    <p>
      ${address.street}<br/>
      ${address.city}, ${address.state}<br/>
      ${address.country} - ${address.zipcode}
    </p>

    <p>📦 We’ll notify you once your order is shipped.</p>
    <br/>
    <p>Thanks for shopping with us!</p>
  `;
};
