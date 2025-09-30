// utils/pdf-generator.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import productModel from "../models/productModel.js";

export const generateInvoicePdf = async (user, items, amount, address, orderId) => {
  return new Promise(async (resolve, reject) => {
    const invoicesDir = path.resolve("./invoices");
    const invoicePath = path.join(invoicesDir, `Invoice-${orderId}.pdf`);

    // Ensure "invoices" folder exists
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir);
    }

    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(invoicePath);
    doc.pipe(writeStream);

    // Optional: Add logo
    const logoPath = path.resolve("./assets/logo.png"); // Adjust as needed
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width / 2 - 50, 20, { width: 100 });
      doc.moveDown(2);
    }

    // Header
    doc.fontSize(24).font("Helvetica-Bold").text("Invoice", { align: "center" });
    doc.moveDown();

    // Customer Info
    doc.fontSize(12).font("Helvetica").text(`Order ID: ${orderId}`);
    doc.text(`Customer: ${user?.name || "N/A"}`);
    doc.text(`Email: ${user?.email || "N/A"}`);
    doc.moveDown();

    // Shipping Address
    doc.font("Helvetica-Bold").text("Shipping Address:");
    doc.font("Helvetica").text(`${address?.street || ""}`);
    doc.text(`${address?.city || ""}, ${address?.state || ""}`);
    doc.text(`${address?.country || ""} - ${address?.zipcode || ""}`);
    doc.moveDown(1.5);

    // Table Header
    doc.font("Helvetica-Bold");
    doc.text("Product", 50, doc.y);
    doc.text("Qty", 280, doc.y);
    doc.text("Price", 330, doc.y);
    doc.text("Total", 420, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Fetch all products in parallel
    const products = await Promise.all(
      items.map(async (item) => {
        return productModel.findById(item.id);
      })
    );

    // Render each line item
    doc.font("Helvetica");
    items.forEach((item, index) => {
      const product = products[index];
      const name = product?.name || `Item ${index + 1}`;
      const quantity = typeof item?.quantity === "number" ? item.quantity : 1;
      const price = typeof product?.price === "number" ? product.price : 0;
      const total = price * quantity;

      if (!product?.name || product.price === undefined) {
        console.warn(`⚠️ Invalid item structure at index ${index}:`, item);
      }

      doc.text(name, 50, doc.y);
      doc.text(quantity.toString(), 280, doc.y);
      doc.text(`£${price.toFixed(2)}`, 330, doc.y);
      doc.text(`£${total.toFixed(2)}`, 420, doc.y);
      doc.moveDown();
    });

    // Total
    doc.moveDown(1);
    doc.font("Helvetica-Bold").text(`Total Amount: £${amount.toFixed(2)}`, {
      align: "right",
    });

    doc.end();

    writeStream.on("finish", () => resolve(invoicePath));
    writeStream.on("error", (err) => reject(err));
  });
};
