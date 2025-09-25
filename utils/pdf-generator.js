// utils/pdf-generator.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Ensure this function returns a full path to the generated PDF
export const generateInvoicePdf = async (user, items, amount, address, orderId) => {
  return new Promise((resolve, reject) => {
    const invoicePath = path.resolve(`./invoices/Invoice-${orderId}.pdf`);
    const doc = new PDFDocument();

    // Ensure "invoices" folder exists
    const invoicesDir = path.resolve("./invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir);
    }

    const writeStream = fs.createWriteStream(invoicePath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(20).text("Invoice", { align: "center" });
    doc.moveDown();

    // Customer Info
    doc.fontSize(12).text(`Order ID: ${orderId}`);
    doc.text(`Customer: ${user.name || "N/A"}`);
    doc.text(`Email: ${user.email}`);
    doc.moveDown();

    // Shipping Address
    doc.text("Shipping Address:");
    doc.text(`${address.street}, ${address.city}, ${address.state}`);
    doc.text(`${address.country} - ${address.zipcode}`);
    doc.moveDown();

    // Table Header
    doc.font("Helvetica-Bold").text("Product", 50, doc.y);
    doc.text("Qty", 300, doc.y);
    doc.text("Price", 350, doc.y);
    doc.text("Total", 450, doc.y);
    doc.moveDown();

    // Items
    doc.font("Helvetica");
   items.forEach((item, index) => {
  const name = item?.name || `Item ${index + 1}`;
  const quantity = typeof item?.quantity === "number" ? item.quantity : 1;
  const price = typeof item?.price === "number" ? item.price : 0;
  const total = price * quantity;

  // Log problematic items
  if (!item?.name || item.quantity === undefined || item.price === undefined) {
    console.warn(`⚠️ Invalid item structure at index ${index}:`, item);
  }

  doc.text(name, 50, doc.y);
  doc.text(quantity.toString(), 300, doc.y);
  doc.text(`£${price.toFixed(2)}`, 350, doc.y);
  doc.text(`£${total.toFixed(2)}`, 450, doc.y);
  doc.moveDown();
});


    doc.moveDown();

    // Total
    doc.font("Helvetica-Bold").text(`Total Amount: £${amount.toFixed(2)}`, { align: "right" });

    doc.end();

    writeStream.on("finish", () => {
      resolve(invoicePath);
    });

    writeStream.on("error", (err) => {
      reject(err);
    });
  });
};
