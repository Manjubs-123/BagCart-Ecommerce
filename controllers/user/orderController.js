import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import PDFDocument from "pdfkit";
import fs from "fs";

export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { addressId, paymentMethod } = req.body;

    // 1️⃣ Load user & find selected address
    const user = await User.findById(userId);
    if (!user) return res.json({ success: false, message: "User not found" });

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.json({ success: false, message: "Invalid address" });
    }

    // 2️⃣ Load cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    // 3️⃣ Validate stock & prepare order items
    let subtotal = 0;
    let orderItems = [];
    let itemCount = 1;

    // Generate OrderId: BGH-2025-001
    const year = new Date().getFullYear();
    const count = await Order.countDocuments() + 1;
    const newOrderId = `BGH-${year}-${String(count).padStart(3, "0")}`;

    for (let item of cart.items) {
      const product = item.product;
      const variant = product.variants[item.variantIndex];

      if (!variant || variant.stock < item.quantity) {
        return res.json({
          success: false,
          message: `${product.name} has only ${variant.stock} left`
        });
      }

      const price = variant.price;
      subtotal += price * item.quantity;

   orderItems.push({
  itemOrderId: `${newOrderId}/${itemCount}`,
  product: product._id,
  variantIndex: item.variantIndex,
  quantity: item.quantity,
  price,
  color: variant.color,
  image: variant.images?.[0]?.url || "",
  status: "pending"
});

itemCount++;



    }

    // 4️⃣ Tax + shipping
    const tax = subtotal * 0.1;
    const shippingFee = subtotal > 500 ? 0 : 50;
    const totalAmount = subtotal + tax + shippingFee;

    // 5️⃣ Create order
    const order = await Order.create({
      orderId: newOrderId,
      user: userId,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country
      },
      items: orderItems,
      paymentMethod,
      subtotal,
      tax,
      shippingFee,
      totalAmount
    });
  // 🔥 Generate readable orderId if missing
if (!order.orderId) {
  order.orderId = `BGH-${Date.now()}`;
}

// 🔥 Assign itemOrderId → BGH-123456789/1, /2, /3
// 🔥 Assign itemOrderId → BGH-123456789/1, /2, /3
order.items.forEach((item, index) => {
  item.itemOrderId = `${order.orderId}/${index + 1}`;
});

// Force Mongoose to detect nested changes
order.markModified("items");

await order.save();




    // 6️⃣ Reduce stock
    for (let item of cart.items) {
      const product = await Product.findById(item.product._id);
      product.variants[item.variantIndex].stock -= item.quantity;
      await product.save();
    }

    // 7️⃣ Clear cart
    cart.items = [];
    await cart.save();

    return res.json({
      success: true,
      message: "Order placed successfully!",
      orderId: order._id,
      displayOrderId: newOrderId
    });

  } catch (err) {
    console.error("Order Error:", err);
    res.json({ success: false, message: "Something went wrong placing the order" });
  }
};
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


// export const getMyOrders = async (req, res) => {
//   try {
//     const userId = req.session.user.id;

//     // Fetch all orders of user
//     let orders = await Order.find({ user: userId })
//       .populate("items.product")
//       .sort({ createdAt: -1 }); // 🔥 latest order first

//     // Sort items inside each order (latest first)
//     orders = orders.map(order => {
//       order.items.sort((a, b) => {
//         return b._id.getTimestamp() - a._id.getTimestamp();
//       });
//       return order;
//     });

//     res.render("user/orders", {
//       orders,
//       user: req.session.user,
//       wishlistCount: 0,
//       unreadNotifications: 0,
//     });

//   } catch (err) {
//     console.error("getMyOrders error:", err);
//     res.status(500).send("Server error");
//   }
// };


// Ensure getMyOrders sorts descending (latest first)
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/user/login");

    // Latest orders first
    const orders = await Order.find({ user: userId })
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    res.render("user/myOrders", {
      orders,
      user: req.session.user,
      wishlistCount: req.session.user?.wishlistCount || 0,
      unreadNotifications: 0,
      currentPage: "orders"
    });
  } catch (err) {
    console.error("getMyOrders Error:", err);
    res.status(500).render("user/myOrders", {
      orders: [],
      user: req.session.user,
      wishlistCount: 0,
      unreadNotifications: 0,
      currentPage: "orders"
    });
  }
};

// Download invoice for a specific item in an order
export const downloadInvoice = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user?.id;

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("items.product").lean();
    if (!order) return res.status(404).send("Order not found");

    const item = order.items.find(i => i._id.toString() === itemId || i.itemOrderId === itemId);
    if (!item) return res.status(404).send("Order item not found");

    const fileName = `Invoice-${order.orderId || order._id}-${(item.itemOrderId || item._id)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Header
    doc.fontSize(22).text("BagHub", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).text("INVOICE", { align: "center" });
    doc.moveDown(1);

    // Order info
    doc.fontSize(12).text(`Order ID: ${order.orderId || order._id}`);
    doc.text(`Item: ${item.product?.name || "Product"}`);
    doc.text(`Item Order ID: ${item.itemOrderId || item._id}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.moveDown();

    // Shipping address
    doc.fontSize(12).text("Shipping Address:", { underline: true });
    doc.moveDown(0.3);
    const sa = order.shippingAddress || {};
    doc.text(sa.fullName || "");
    doc.text(sa.addressLine1 || "");
    if (sa.addressLine2) doc.text(sa.addressLine2);
    doc.text(`${sa.city || ""}, ${sa.state || ""} - ${sa.pincode || ""}`);
    doc.text(`Phone: ${sa.phone || ""}`);
    doc.moveDown();

    // Item details
    doc.fontSize(12).text("Product Details:", { underline: true });
    doc.moveDown(0.3);
    doc.text(`Product: ${item.product?.name || "N/A"}`);
    doc.text(`Color: ${item.color || "N/A"}`);
    doc.text(`Quantity: ${item.quantity}`);
    doc.text(`Price per unit: ₹${item.price}`);
    doc.text(`Total: ₹${(item.price * item.quantity).toFixed(2)}`);
    doc.moveDown();

    // Totals (showing full order totals)
    doc.text(`Subtotal: ₹${order.subtotal?.toFixed(2) || "0.00"}`);
    doc.text(`Tax: ₹${order.tax?.toFixed(2) || "0.00"}`);
    doc.text(`Shipping Fee: ₹${order.shippingFee?.toFixed(2) || "0.00"}`);
    doc.moveDown();
    doc.fontSize(14).text(`Grand Total: ₹${order.totalAmount?.toFixed(2) || "0.00"}`, { underline: true });

    doc.end();
  } catch (err) {
    console.error("downloadInvoice error:", err);
    res.status(500).send("Could not generate invoice");
  }
};

// Cancel item (already have similar — ensure field names match)
export const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.status === "delivered" || item.status === "cancelled" || item.status === "returned") {
      return res.json({ success: false, message: "Cannot cancel this item" });
    }

    // increase stock back
    const product = await Product.findById(item.product);
    if (product && product.variants[item.variantIndex]) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save();
    }

    item.status = "cancelled";
    item.cancelReason = reason || "No reason provided";
    item.cancelledDate = new Date();

    // optional: update order-level status if all items cancelled/returned
    const allCancelledOrReturned = order.items.every(i => ["cancelled", "returned"].includes(i.status));
    if (allCancelledOrReturned) order.orderStatus = "cancelled";

    await order.save();
    return res.json({ success: true, message: "Item cancelled" });
  } catch (err) {
    console.error("cancelItem error:", err);
    return res.json({ success: false, message: "Error cancelling item" });
  }
};

// Return item
export const returnItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, details } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.status !== "delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }

    item.status = "returned";
    item.returnReason = reason;
    item.returnDetails = details;
    item.returnedDate = new Date();

    await order.save();
    return res.json({ success: true, message: "Return request submitted" });
  } catch (err) {
    console.error("returnItem error:", err);
    return res.json({ success: false, message: "Error submitting return" });
  }
};