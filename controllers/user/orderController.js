import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";


export const getOrderConfirmation = async (req, res) => {
  const orderId = req.params.id;

 const order = await Order.findById(orderId)
  .populate({
    path: "items.product",
    select: "name brand variants images"   // safe selection
  })
  .lean();

  console.log("hello")

  res.render("user/orderConfirmation", { order });
};



export const getMyOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/user/login");

    // Fetch orders
    let orders = await Order.find({ user: userId })
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    // FIX itemOrderId if missing
    orders = orders.map(order => {
      const fixedItems = order.items.map((item, index) => ({
        ...item,
        itemOrderId: item.itemOrderId || `${order.orderId || order._id}/${index + 1}`
      }));

      return {
        ...order,
        items: fixedItems
      };
    });

    // Add Order Count
    const ordersCount = orders.length;

    // FINAL RENDER (clean — NO notifications)
    res.render("user/myOrders", {
      orders,
      user: req.session.user,
      ordersCount,        
      currentPage: "orders"
    });

  } catch (err) {
    console.error("getMyOrders Error:", err);

    res.status(500).render("user/myOrders", {
      orders: [],
      user: req.session.user,
      ordersCount: 0,     
      currentPage: "orders"
    });
  }
};


export const downloadInvoice = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user?.id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("items.product")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    //  locate item
    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) return res.status(404).send("Order item not found");

    //  always show correct Order ID
    const displayOrderId = order.orderId || order._id.toString();

    // FIXE always show correct item-order-id
    const displayItemOrderId =
      item.itemOrderId ||
      `${displayOrderId}/${order.items.indexOf(item) + 1}`;

    // Good filename
    const fileName = `Invoice-${displayOrderId}-${displayItemOrderId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

 const doc = new PDFDocument({ margin: 40 });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// correct font path
    const fontPath = path.join(__dirname, "../../public/fonts/DejaVuSans.ttf");


doc.registerFont("Unicode", fontPath);
doc.font("Unicode");

doc.pipe(res);




    // HEADER
    doc.fontSize(22).text("BagHub", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("INVOICE", { align: "center" });
    doc.moveDown(2);

    // ORDER INFO
    doc.fontSize(12).text(`Order ID: ${displayOrderId}`);
    doc.text(`Item Order ID: ${displayItemOrderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.moveDown(1);

    // SHIPPING ADDRESS
    const sa = order.shippingAddress;
    doc.fontSize(12).text("Shipping Address:", { underline: true });
    doc.text(sa.fullName);
    doc.text(sa.addressLine1);
    if (sa.addressLine2) doc.text(sa.addressLine2);
    doc.text(`${sa.city}, ${sa.state} - ${sa.pincode}`);
    doc.text(`Phone: ${sa.phone}`);
    doc.moveDown(1);

    // ITEM INFO
    doc.fontSize(12).text("Product Details:", { underline: true });
    doc.text(`Product: ${item.product?.name}`);
    doc.text(`Color: ${item.color}`);
    doc.text(`Quantity: ${item.quantity}`);
    doc.text(`Unit Price: ₹${item.price}`);
    doc.text(`Item Total: ₹${(item.price * item.quantity).toFixed(2)}`);
    doc.moveDown(1);

    // ORDER TOTALS
    doc.text(`Subtotal: ₹${order.subtotal.toFixed(2)}`);
    doc.text(`Tax: ₹${order.tax.toFixed(2)}`);
    doc.text(`Shipping: ₹${order.shippingFee.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text(`Grand Total: ₹${order.totalAmount.toFixed(2)}`);

    doc.end();
  } catch (err) {
    console.error("downloadInvoice Error:", err);
    res.status(500).send("Could not generate invoice");
  }
};


export const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, details } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (["delivered", "cancelled", "returned"].includes(item.status)) {
      return res.json({ success: false, message: "Cannot cancel this item" });
    }

    //  Add stock back
    const product = await Product.findById(item.product);
    if (product) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save();
    }

    //  THIS IS THE IMPORTANT PART — YOU MISSED THIS EARLIER
    item.status = "cancelled";
    item.cancelReason = reason;
    item.cancelDetails = details || "";
    item.cancelledDate = new Date();

    const allCancelled = order.items.every(i => ["cancelled", "returned"].includes(i.status));
    if (allCancelled) order.orderStatus = "cancelled";

    await order.save();

    return res.json({ success: true, message: "Item cancelled successfully" });

  } catch (err) {
    console.error("Cancel Error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};



export const returnItem= async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { rejectionReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    item.status = "return-rejected";
    item.returnRejectReason = rejectionReason || "Rejected by admin";
    item.returnRejectedDate = new Date();

    await order.save();

    return res.json({
      success: true,
      message: "Return rejected successfully"
    });

  } catch (error) {
    console.error("Reject return error:", error);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
};

