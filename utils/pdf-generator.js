import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import productModel from "../models/productModel.js";

export const generateInvoicePdf = async (user, items, amount, address, orderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🧾 Generating professional invoice:", orderId);

      const invoicesDir = path.resolve("./invoices");
      const invoicePath = path.join(invoicesDir, `Invoice-${orderId}.pdf`);

      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir);
      }

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const writeStream = fs.createWriteStream(invoicePath);
      doc.pipe(writeStream);

      // --- Colors (classic with accent) ---
      const colors = {
        accent: "#4F46E5", // Indigo
        grayDark: "#111827",
        grayMedium: "#6B7280",
        grayLight: "#F9FAFB",
        border: "#E5E7EB",
      };

      // ---------------- HEADER ----------------
      const logoPath = path.resolve("assets/icon_logo.png");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 80 });
      }

      doc
        .fillColor(colors.accent)
        .font("Helvetica-Bold")
        .fontSize(24)
        .text("Panache By Soh", 0, 50, { align: "right" });

      doc
        .fontSize(10)
        .fillColor(colors.grayMedium)
        .text("www.panachebysoh.com", { align: "right" })
        .text("support@panachebysoh.com", { align: "right" })
        .text("+44 1234 567890", { align: "right" });

      doc.moveDown(2);

      // ---------------- INVOICE TITLE ----------------
      doc
        .fontSize(28)
        .fillColor(colors.grayDark)
        .font("Helvetica-Bold")
        .text("INVOICE", { align: "center" });

      doc.moveDown(1);

      // ---------------- INFO GRID ----------------
      const invoiceDate = new Date().toLocaleDateString();
      const dueDate = new Date(Date.now() + 7 * 86400000).toLocaleDateString();

      doc
        .fontSize(12)
        .fillColor(colors.grayDark)
        .font("Helvetica-Bold")
        .text("Invoice Details", 50, doc.y);

      doc
        .font("Helvetica")
        .fillColor(colors.grayMedium)
        .fontSize(11)
        .text(`Invoice ID: ${orderId}`)
        .text(`Invoice Date: ${invoiceDate}`)
        .text(`Payment Due: ${dueDate}`);

      doc.moveUp(3); // Move up to align client info at right

      doc
        .font("Helvetica-Bold")
        .fillColor(colors.grayDark)
        .text("Billed To", 350, doc.y);

      doc
        .font("Helvetica")
        .fillColor(colors.grayMedium)
        .fontSize(11)
        .text(user?.name || "N/A", 350)
        .text(user?.email || "N/A", 350)
        .text(address?.street || "N/A", 350)
        .text(`${address?.city || ""}, ${address?.state || ""}`, 350)
        .text(`${address?.country || ""} - ${address?.zipcode || ""}`, 350);

      doc.moveDown(2);

      // ---------------- PRODUCT TABLE ----------------
      const tableTop = doc.y + 10;

      // Table Header
      doc
        .lineWidth(1)
        .strokeColor(colors.border)
        .rect(50, tableTop, doc.page.width - 100, 25)
        .stroke()
        .fill(colors.accent);

      doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Product", 60, tableTop + 7)
        .text("Qty", 300, tableTop + 7, { width: 50, align: "center" })
        .text("Price", 380, tableTop + 7, { width: 70, align: "right" })
        .text("Total", 470, tableTop + 7, { width: 70, align: "right" });

      // Table Rows
      const products = await Promise.all(
        items.map((item) => productModel.findById(item.id))
      );

      let yPos = tableTop + 25;

      items.forEach((item, i) => {
        const product = products[i];
        const sizeKey = Object.keys(item).find(
          (k) => !["id", "name", "image", "_id", "productId"].includes(k)
        );
        const quantity = item[sizeKey] || 1;
        const productName = product?.name || `Item ${i + 1}`;
        const displayName = sizeKey ? `${productName} (${sizeKey})` : productName;
        const price = typeof product?.price === "number" ? product.price : 0;
        const total = price * quantity;

        // Stripe effect
        if (i % 2 === 0) {
          doc
            .rect(50, yPos, doc.page.width - 100, 24)
            .fill(colors.grayLight);
        }

        doc
          .fillColor(colors.grayDark)
          .font("Helvetica")
          .fontSize(11)
          .text(displayName, 60, yPos + 6);

        doc.text(quantity.toString(), 300, yPos + 6, { width: 50, align: "center" });
        doc.text(`£${price.toFixed(2)}`, 380, yPos + 6, { width: 70, align: "right" });
        doc.text(`£${total.toFixed(2)}`, 470, yPos + 6, { width: 70, align: "right" });

        yPos += 24;
      });

      doc.y = yPos + 20;

      // ---------------- TOTALS SECTION ----------------
      const totalBoxX = doc.page.width - 280;
      const boxY = doc.y;

      const subtotal = amount * 0.9; // Example: subtotal before tax
      const tax = amount * 0.1;

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(colors.grayDark)
        .text("Subtotal:", totalBoxX, boxY, { align: "right" })
        .text("Tax (10%):", totalBoxX, boxY + 20, { align: "right" })
        .text("Total:", totalBoxX, boxY + 40, { align: "right" });

      doc
        .font("Helvetica")
        .fillColor(colors.grayMedium)
        .text(`£${subtotal.toFixed(2)}`, totalBoxX + 80, boxY, { align: "right" })
        .text(`£${tax.toFixed(2)}`, totalBoxX + 80, boxY + 20, { align: "right" })
        .font("Helvetica-Bold")
        .fillColor(colors.accent)
        .fontSize(14)
        .text(`£${amount.toFixed(2)}`, totalBoxX + 80, boxY + 40, { align: "right" });

      doc.moveDown(6);

      // ---------------- FOOTER ----------------
      doc
        .strokeColor(colors.border)
        .lineWidth(1)
        .moveTo(50, doc.page.height - 90)
        .lineTo(doc.page.width - 50, doc.page.height - 90)
        .stroke();

      doc
        .fontSize(10)
        .fillColor(colors.grayMedium)
        .font("Helvetica-Oblique")
        .text(
          "Thank you for shopping with Panache By Soh. For questions, contact support@panachebysoh.com",
          50,
          doc.page.height - 75,
          { width: doc.page.width - 100, align: "center" }
        );

      doc
        .fontSize(9)
        .fillColor(colors.grayMedium)
        .text("Page 1 of 1", 50, doc.page.height - 50, {
          width: doc.page.width - 100,
          align: "center",
        });

      doc.end();

      writeStream.on("finish", () => {
        console.log("✅ Invoice created:", invoicePath);
        resolve(invoicePath);
      });
      writeStream.on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
};
