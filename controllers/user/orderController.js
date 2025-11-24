import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// export const placeOrder = async (req, res) => {
//   try {
//     const userId = req.session.user.id;
//     const { addressId, paymentMethod } = req.body;

//     // 1️⃣ Load user & find selected address
//     const user = await User.findById(userId);
//     if (!user) return res.json({ success: false, message: "User not found" });

//     const address = user.addresses.id(addressId);
//     if (!address) {
//       return res.json({ success: false, message: "Invalid address" });
//     }

//     // 2️⃣ Load cart
//     const cart = await Cart.findOne({ user: userId }).populate("items.product");
//     if (!cart || cart.items.length === 0) {
//       return res.json({ success: false, message: "Cart is empty" });
//     }

//     // 3️⃣ Validate stock & prepare order items
//     let subtotal = 0;
//     let orderItems = [];
//     let itemCount = 1;

//     // Generate OrderId: BGH-2025-001
//     const year = new Date().getFullYear();
//     const count = await Order.countDocuments() + 1;
//     const newOrderId = `BGH-${year}-${String(count).padStart(3, "0")}`;

//     for (let item of cart.items) {
//       const product = item.product;
//       const variant = product.variants[item.variantIndex];

//       if (!variant || variant.stock < item.quantity) {
//         return res.json({
//           success: false,
//           message: `${product.name} has only ${variant.stock} left`
//         });
//       }

//       const price = variant.price;
//       subtotal += price * item.quantity;

//    orderItems.push({
//   itemOrderId: `${newOrderId}/${itemCount}`,
//   product: product._id,
//   variantIndex: item.variantIndex,
//   quantity: item.quantity,
//   price,
//   color: variant.color,
//   image: variant.images?.[0]?.url || "",
//   status: "pending"
// });

// itemCount++;



//     }

//     // 4️⃣ Tax + shipping
//     const tax = subtotal * 0.1;
//     const shippingFee = subtotal > 500 ? 0 : 50;
//     const totalAmount = subtotal + tax + shippingFee;

//     // 5️⃣ Create order
//     const order = await Order.create({
//       orderId: newOrderId,
//       user: userId,
//       shippingAddress: {
//         fullName: address.fullName,
//         phone: address.phone,
//         addressLine1: address.addressLine1,
//         addressLine2: address.addressLine2,
//         city: address.city,
//         state: address.state,
//         pincode: address.pincode,
//         country: address.country
//       },
//       items: orderItems,
//       paymentMethod,
//       subtotal,
//       tax,
//       shippingFee,
//       totalAmount,
//       orderStatus: "pending"
//     });
//   // 🔥 Generate readable orderId if missing
// if (!order.orderId) {
//   order.orderId = `BGH-${Date.now()}`;
// }

// // 🔥 Assign itemOrderId → BGH-123456789/1, /2, /3
// // 🔥 Assign itemOrderId → BGH-123456789/1, /2, /3
// order.items.forEach((item, index) => {
//   item.itemOrderId = `${order.orderId}/${index + 1}`;
// });

// // Force Mongoose to detect nested changes
// order.markModified("items");

// await order.save();




//     // 6️⃣ Reduce stock
// // 6️⃣ Reduce stock
// for (let item of cart.items) {

//   console.log("🔥 REDUCING STOCK FOR:", {
//     productId: item.product._id,
//     variantIndex: item.variantIndex,
//     quantity: item.quantity
//   });

//   const product = await Product.findById(item.product._id);

//   if (!product) {
//     console.log("❌ Product not found:", item.product._id);
//     continue;
//   }

//   const variant = product.variants[item.variantIndex];

//   if (!variant) {
//     console.log("❌ Variant not found:", item.variantIndex);
//     continue;
//   }

//   console.log("📉 Stock before:", variant.stock);

//   // ---- REAL STOCK REDUCTION ----
//   variant.stock -= item.quantity;

//   // Force mongoose to detect nested change
//   product.markModified(`variants.${item.variantIndex}.stock`);

//   await product.save();

//   console.log("📈 Stock after:", variant.stock);
// }


//     // 7️⃣ Clear cart
//     cart.items = [];
//     await cart.save();

//     return res.json({
//       success: true,
//       message: "Order placed successfully!",
//       orderId: order._id,
//       displayOrderId: newOrderId
//     });

//   } catch (err) {
//     console.error("Order Error:", err);
//     res.json({ success: false, message: "Something went wrong placing the order" });
//   }
// };

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


// Ensure getMyOrders sorts descending (latest first)
// export const getMyOrders = async (req, res) => {
//   try {
//     const userId = req.session.user?.id;
//     if (!userId) return res.redirect("/user/login");

//     // Latest orders first
//     const orders = await Order.find({ user: userId })
//       .populate("items.product")
//       .sort({ createdAt: -1 })
//       .lean();

//     res.render("user/myOrders", {
//       orders,
//       user: req.session.user,
//       wishlistCount: req.session.user?.wishlistCount || 0,
//       unreadNotifications: 0,
//       currentPage: "orders"
//     });
//   } catch (err) {
//     console.error("getMyOrders Error:", err);
//     res.status(500).render("user/myOrders", {
//       orders: [],
//       user: req.session.user,
//       wishlistCount: 0,
//       unreadNotifications: 0,
//       currentPage: "orders"
//     });
//   }
// };
// export const getMyOrders = async (req, res) => {
//   try {
//     const userId = req.session.user?.id;
//     if (!userId) return res.redirect("/user/login");

//     let orders = await Order.find({ user: userId })
//       .populate("items.product")
//       .sort({ createdAt: -1 })
//       .lean();

//     // 🔥 FIX itemOrderId MISSING
//     orders = orders.map(order => {
//       const fixedItems = order.items.map((item, index) => ({
//         ...item,
//         itemOrderId: item.itemOrderId || `${order.orderId || order._id}/${index + 1}`
//       }));

//       return {
//         ...order,
//         items: fixedItems
//       };
//     });

//     res.render("user/myOrders", {
//       orders,
//       user: req.session.user,
//       wishlistCount: req.session.user?.wishlistCount || 0,
//       unreadNotifications: 0,
//       currentPage: "orders"
//     });

//   } catch (err) {
//     console.error("getMyOrders Error:", err);
//     res.status(500).render("user/myOrders", {
//       orders: [],
//       user: req.session.user,
//       wishlistCount: 0,
//       unreadNotifications: 0,
//       currentPage: "orders"
//     });
//   }
// };

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/user/login");

    // Fetch orders
    let orders = await Order.find({ user: userId })
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    // 🔥 FIX itemOrderId if missing
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
      ordersCount,        // ✔ added
      currentPage: "orders"
    });

  } catch (err) {
    console.error("getMyOrders Error:", err);

    res.status(500).render("user/myOrders", {
      orders: [],
      user: req.session.user,
      ordersCount: 0,     // ✔ added
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

    // Fix: locate item
    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) return res.status(404).send("Order item not found");

    // FIXED: always show correct Order ID
    const displayOrderId = order.orderId || order._id.toString();

    // FIXED: always show correct item-order-id
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


// Cancel item (already have similar — ensure field names match)
// export const cancelItem = async (req, res) => {
//   try {
//     const { orderId, itemId } = req.params;
//     const { reason } = req.body;
//     const userId = req.session.user.id;

//     const order = await Order.findOne({ _id: orderId, user: userId });
//     if (!order) return res.json({ success: false, message: "Order not found" });

//     const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId);
//     if (!item) return res.json({ success: false, message: "Item not found" });

//     if (item.status === "delivered" || item.status === "cancelled" || item.status === "returned") {
//       return res.json({ success: false, message: "Cannot cancel this item" });
//     }

//     // increase stock back
//     const product = await Product.findById(item.product);
//     if (product && product.variants[item.variantIndex]) {
//       product.variants[item.variantIndex].stock += item.quantity;
//       await product.save();
//     }

//     item.status = "cancelled";
//     item.cancelReason = reason || "No reason provided";
//     item.cancelDetails = req.body.details || "";
//     item.cancelledDate = new Date();

//     // optional: update order-level status if all items cancelled/returned
//     const allCancelledOrReturned = order.items.every(i => ["cancelled", "returned"].includes(i.status));
//     if (allCancelledOrReturned) order.orderStatus = "cancelled";

//     await order.save();
//     return res.json({ success: true, message: "Item cancelled" });
//   } catch (err) {
//     console.error("cancelItem error:", err);
//     return res.json({ success: false, message: "Error cancelling item" });
//   }
// };

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

    // 🔼 Add stock back
    const product = await Product.findById(item.product);
    if (product) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save();
    }

    // 🔥 THIS IS THE IMPORTANT PART — YOU MISSED THIS EARLIER
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


// Return item
// export const returnItem = async (req, res) => {
//   try {
//     const { orderId, itemId } = req.params;
//     const { reason, details } = req.body;
//     const userId = req.session.user.id;

//     const order = await Order.findOne({ _id: orderId, user: userId });
//     if (!order) return res.json({ success: false, message: "Order not found" });

//     const item = order.items.id(itemId);
//     if (!item) return res.json({ success: false, message: "Item not found" });

//     if (item.status !== "delivered") {
//       return res.json({ success: false, message: "Only delivered items can be returned" });
//     }

//     // USER SHOULD ONLY REQUEST RETURN
//     item.status = "return-requested";
//     item.returnReason = reason;
//     item.returnDetails = details;
//     item.returnRequestedDate = new Date();

//     await order.save();

//     return res.json({
//       success: true,
//       message: "Return request submitted. Waiting for admin approval."
//     });

//   } catch (err) {
//     console.error("returnItem error:", err);
//     return res.json({ success: false, message: "Error submitting return" });
//   }
// };
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

