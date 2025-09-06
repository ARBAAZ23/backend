export const orderConfirmationTemplate = (user, items, amount, address) => {
  const productHtml = items
    .map((item) => {
      const product = item.productId || item;

      // if productId is just an ID (not populated), skip details
      if (typeof product === "string") {
        return `
          <tr>
            <td colspan="5">⚠️ Product details not available for ID: ${product}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td><img src="${Array.isArray(product.image) ? product.image[0] : product.image}" width="50" /></td>
          <td>${product.name || "Product"}</td>
          <td>${item.quantity}</td>
          <td>₹${product.price || 0}</td>
          <td>₹${(product.price || 0) * item.quantity}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <h2>Hi ${address.firstName || user.name},</h2>
    <p>🎉 Your order has been placed successfully!</p>
    
    <h3>🛍 Order Summary</h3>
    <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
      <thead>
        <tr>
          <th>Image</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${productHtml}
      </tbody>
    </table>
    
    <h3>Grand Total: ₹${amount}</h3>
    <p><b>Delivery Address:</b></p>
    <p>${address.street}, ${address.city}, ${address.state}, ${address.country} - ${address.zipcode}</p>
    
    <p>📦 We’ll notify you once your order is shipped.</p>
    <br/>
    <p>Thanks for shopping with us!</p>
  `;
};
