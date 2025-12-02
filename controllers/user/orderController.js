
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to generate safe custom order ID
const generateOrderId = () => {
  return "BH-" + Math.floor(100000 + Math.random() * 900000).toString();
};

export const createOrder = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId || !paymentMethod) {
            return res.json({ success: false, message: "Missing data" });
        }

        const cart = await Cart.findOne({ user: userId })
            .populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Cart empty" });
        }

        const user = await User.findById(userId);
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.json({ success: false, message: "Address not found" });
        }

        const orderItems = cart.items.map(item => {
            const variant = item.product.variants[item.variantIndex];
            return {
                product: item.product._id,
                variantIndex: item.variantIndex,
                quantity: item.quantity,
                price: variant.price,
                color: variant.color,
                image: variant.images[0]?.url || ""
            };
        });

        const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = subtotal * 0.1;
        const shippingFee = subtotal > 500 ? 0 : 50;
        const totalAmount = subtotal + tax + shippingFee;

        // ✅ Generate custom order ID
        const customOrderId = generateOrderId();

        const order = await Order.create({
            orderId: customOrderId, // ✅ Store custom ID
            user: userId,
            items: orderItems,
            shippingAddress: address,
            paymentMethod,
            subtotal,
            tax,
            shippingFee,
            totalAmount,
            paymentStatus: paymentMethod === "cod" ? "pending" : "paid"
        });

        // Stock reduction logic
        for (let item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (!product) continue;

            const variant = product.variants[item.variantIndex];
            if (!variant) continue;

            variant.stock -= item.quantity;
            product.markModified(`variants.${item.variantIndex}.stock`);
            await product.save();
        }

        // Clear cart
        cart.items = [];
        await cart.save();

        // ✅ Return MongoDB _id for route compatibility BUT also include custom orderId
        return res.json({
            success: true,
            orderId: order._id, // ✅ Keep _id for existing routes
            customOrderId: order.orderId // ✅ Also return custom ID for display
        });

    } catch (err) {
        console.error("ORDER ERROR:", err);
        return res.json({ success: false, message: "Order failed" });
    }
};

export const getOrderConfirmation = async (req, res) => {
  try {
    const mongoOrderId = req.params.id; // This is MongoDB _id from route
    
    // ✅ Find by MongoDB _id (existing route compatibility)
    const order = await Order.findById(mongoOrderId)
      .populate({ path: "items.product", select: "name brand variants images" })
      .lean();

    if (!order) return res.redirect("/order/orders");

    // ✅ Use custom orderId for display
    const orderDisplayId = order.orderId;

    console.log("✔ UI Order ID =", orderDisplayId);

    res.render("user/orderConfirmation", {
      order,
      orderDisplayId
    });
  } catch (err) {
    console.error(err);
    res.redirect("/order/orders");
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/user/login");

    let orders = await Order.find({ user: userId })
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    // Fix itemOrderId using custom orderId
    orders = orders.map(order => {
      const fixedItems = order.items.map((item, index) => ({
        ...item,
        itemOrderId: item.itemOrderId || `${order.orderId}-${index + 1}` // ✅ Use custom orderId
      }));

      return {
        ...order,
        items: fixedItems
      };
    });

    const ordersCount = orders.length;

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
    const { orderId, itemId } = req.params; // orderId is MongoDB _id from route
    const userId = req.session.user?.id;

    console.log("📥 Download Invoice Request:", { orderId, itemId, userId });

    // ✅ Find by MongoDB _id (existing route compatibility)
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("items.product")
      .lean();

    if (!order) {
      console.log("❌ Order not found");
      return res.status(404).send("Order not found");
    }

    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) {
      console.log("❌ Item not found");
      return res.status(404).send("Order item not found");
    }

    // ✅ Use custom orderId for display
    const displayOrderId = order.orderId;
    const displayItemOrderId = item.itemOrderId || `${displayOrderId}-${order.items.indexOf(item) + 1}`;

    console.log("✅ Generating invoice for:", { displayOrderId, displayItemOrderId });

    const fileName = `Invoice-${displayOrderId}-${displayItemOrderId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 40 });
    const fontPath = path.join(__dirname, "../../public/fonts/DejaVuSans.ttf");

    doc.registerFont("Unicode", fontPath);
    doc.font("Unicode");
    doc.pipe(res);

    // HEADER
    doc.fontSize(22).text("BagHub", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("INVOICE", { align: "center" });
    doc.moveDown(2);

    // ORDER INFO - Using custom orderId for display
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
    console.error("❌ downloadInvoice Error:", err);
    res.status(500).send("Could not generate invoice");
  }
};

export const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params; // orderId is MongoDB _id from route
    const { reason, details } = req.body;
    const userId = req.session.user.id;

    // ✅ Find by MongoDB _id (existing route compatibility)
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (["delivered", "cancelled", "returned"].includes(item.status)) {
      return res.json({ success: false, message: "Cannot cancel this item" });
    }

    // Add stock back
    const product = await Product.findById(item.product);
    if (product) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save();
    }

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


export const returnItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params; // orderId is MongoDB _id
    const { reason, details } = req.body;
    const userId = req.session.user.id;

    console.log("📦 Return request:", { orderId, itemId, reason, details, userId });

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      console.log("❌ Order not found");
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      console.log("❌ Item not found");
      return res.json({ success: false, message: "Item not found" });
    }

    // Check if item can be returned (only delivered items)
    if (item.status !== 'delivered') {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }

    // Update item status to return requested
    item.status = 'return-requested';
    item.returnReason = reason;
    item.returnDetails = details || "";
    item.returnRequestedDate = new Date();

    await order.save();

    console.log("✅ Return request submitted successfully");

    return res.json({ 
      success: true, 
      message: "Return request submitted successfully" 
    });

  } catch (error) {
    console.error("❌ Return error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// export const returnItem = async (req, res) => {
//   try {
//     const { orderId, itemId } = req.params; // orderId is MongoDB _id from route
//     const { rejectionReason } = req.body;

//     // ✅ Find by MongoDB _id (existing route compatibility)
//     const order = await Order.findById(orderId);
//     if (!order) return res.status(404).json({ success: false, message: "Order not found" });

//     const item = order.items.id(itemId);
//     if (!item) return res.status(404).json({ success: false, message: "Item not found" });

//     item.status = "return-rejected";
//     item.returnRejectReason = rejectionReason || "Rejected by admin";
//     item.returnRejectedDate = new Date();

//     await order.save();

//     return res.json({
//       success: true,
//       message: "Return rejected successfully"
//     });

//   } catch (error) {
//     console.error("Reject return error:", error);
//     return res.status(500).json({ success: false, message: "Internal error" });
//   }
// };