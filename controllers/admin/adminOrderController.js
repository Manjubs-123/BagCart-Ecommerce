import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Wallet from "../../models/walletModel.js";
import mongoose from "mongoose";

// Helper to build filter
function buildFilter({ search, status, fromDate, toDate }) {
  const filter = {};
  if (status) filter.orderStatus = status;
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }
if (search) {
  const regex = new RegExp(search, "i");

  filter.$or = [
    { orderId: regex },
    { "items.itemOrderId": regex },

    // Search inner item ObjectId safely
    mongoose.isValidObjectId(search)
      ? { "items._id": new mongoose.Types.ObjectId(search) }
      : {}
  ];
}

  return filter;
}

// export const adminListOrders = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = 10;
//     const skip = (page - 1) * limit;

//     const { search, status } = req.query;

//     // --------------------------------
//     // FILTER
//     // --------------------------------
//     let filter = {};

//     if (search) {
//       filter.$or = [
//         { orderId: new RegExp(search, "i") },
//         { "items.itemOrderId": new RegExp(search, "i") }
//       ];
//     }

//     if (status) {
//       filter.orderStatus = status;
//     }

//     // --------------------------------
//     // FETCH TOTALS FOR DASHBOARD CARDS
//     // --------------------------------
//     const totalOrders = await Order.countDocuments(filter);

//     const deliveredOrders = await Order.countDocuments({
//       ...filter,
//       orderStatus: "delivered"
//     });

//     const cancelledOrders = await Order.countDocuments({
//       ...filter,
//       orderStatus: "cancelled"
//     });

//     const inProgressOrders = await Order.countDocuments({
//       ...filter,
//       orderStatus: { $in: ["pending", "processing", "shipped", "out_for_delivery"] }
//     });

//     // --------------------------------
//     // FETCH LIST
//     // --------------------------------
//     const orders = await Order.find(filter)
//       .populate("user", "name email")
//       .populate("items.product", "name")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     // --------------------------------
//     // RENDER PAGE
//     // --------------------------------
//     res.render("admin/orderList", {
//       orders,
//       totalOrders,
//       deliveredOrders,
//       inProgressOrders,
//       cancelledOrders,
//       page,
//       pages: Math.ceil(totalOrders / limit),
//       query: req.query
//     });

//   } catch (err) {
//     console.error("adminListOrders Error:", err);

//     res.render("admin/orderList", {
//       orders: [],
//       totalOrders: 0,
//       deliveredOrders: 0,
//       inProgressOrders: 0,
//       cancelledOrders: 0,
//       page: 1,
//       pages: 1,
//       query: req.query
//     });
//   }
// };


export const adminListOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { search, status } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { orderId: new RegExp(search, "i") },
        { "items.itemOrderId": new RegExp(search, "i") }
      ];
    }

    if (status) {
      filter.orderStatus = status;
    }

    const totalOrders = await Order.countDocuments(filter);

    const deliveredOrders = await Order.countDocuments({
      ...filter,
      orderStatus: "delivered"
    });

    const cancelledOrders = await Order.countDocuments({
      ...filter,
      orderStatus: "cancelled"
    });

    const inProgressOrders = await Order.countDocuments({
      ...filter,
      orderStatus: { $in: ["pending", "processing", "shipped", "out_for_delivery"] }
    });

    // 🔥 RETURN REQUEST COUNT
    const returnCount = await Order.countDocuments({
      "items.status": "return-requested"
    });

    const orders = await Order.find(filter)
      .populate("user", "name email")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render("admin/orderList", {
      orders,
      totalOrders,
      deliveredOrders,
      inProgressOrders,
      cancelledOrders,
      page,
      pages: Math.ceil(totalOrders / limit),
      query: req.query,
      returnCount   // <-- REQUIRED
    });

  } catch (err) {
    console.error("adminListOrders Error:", err);

    res.render("admin/orderList", {
      orders: [],
      totalOrders: 0,
      deliveredOrders: 0,
      inProgressOrders: 0,
      cancelledOrders: 0,
      page: 1,
      pages: 1,
      query: req.query,
      returnCount: 0   // <-- ALSO REQUIRED
    });
  }
};

export const adminGetOrder = async (req, res) => {
  try {
    let order = await Order.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("items.product")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    // 🔥 FIX ITEM ORDER ID FOR ADMIN VIEW
    order.items = order.items.map((item, index) => ({
      ...item,
      itemOrderId: item.itemOrderId || `${order._id}-${index + 1}`
    }));

    res.render("admin/orderDetails", { order });

  } catch (err) {
    console.error("adminGetOrder:", err);
    res.status(500).send("Server error");
  }
};

// Update status and adjust inventory accordingly
export const adminUpdateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Item not found" });
    }


    
const prevStatus = item.status;
// Normalize DB and incoming UI statuses
const normalize = (s) =>
  s.toLowerCase()
   .replace(/ /g, "_")
   .replace(/-/g, "_")
   .trim();

// Normalized versions
const prev = normalize(prevStatus);
const next = normalize(status);

// Allowed transitions
const allowedFlow = {
  pending: ["processing"],
  processing: ["shipped"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
  returned: []
};

// Stop invalid transitions
if (!allowedFlow[prev] || !allowedFlow[prev].includes(next)) {
  await session.abortTransaction();
  session.endSession();
  return res.status(400).json({
    success: false,
    message: `Cannot change status from '${prevStatus}' to '${status}'`
  });
}

// Save normalized status
item.status = next;


    // inventory restock if cancelled
    if (status === "cancelled" && prevStatus !== "delivered" && prevStatus !== "cancelled") {
      const product = await Product.findById(item.product).session(session);
      if (product?.variants?.[item.variantIndex]) {
        product.variants[item.variantIndex].stock += item.quantity;
        await product.save({ session });
      }
    }

    // delivered rule
    if (status === "delivered") {
      item.deliveredDate = new Date();
    }

    // update specific item only
    item.status = status;

    // if ALL items delivered → mark order as delivered
    if (order.items.every(i => i.status === "delivered")) {
      order.orderStatus = "delivered";
    }

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.json({ success: true, message: "Item status updated", itemId });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("adminUpdateOrderStatus:", err);
    return res.status(500).json({ success: false, message: "Error updating item status" });
  }
};

export const adminGetCancelledItems = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const cancelledItems = order.items
      .filter(i => i.status === "cancelled")
      .map(i => ({
        productName: i.product?.name || "Unknown Product",
        cancelReason: i.cancelReason || "No reason provided",
        cancelDetails: i.cancelDetails || "",
        cancelledDate: i.cancelledDate,
        quantity: i.quantity,
        image: i.image,
        itemOrderId: i.itemOrderId
      }));

    return res.json({ success: true, items: cancelledItems });

  } catch (err) {
    console.error("Cancelled list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getReturnRequests = async (req, res) => {
  try {
    const orders = await Order.find({
      "items.status": "return-requested"
    })
    .populate("user")
    .populate("items.product")
    .sort({ createdAt: -1 })
    .lean();
console.log("Return page loaded");

    return res.render("admin/returnRequests", { orders });
  } catch (err) {
    console.error("Return Request Fetch Error:", err);
    res.status(500).send("Server Error");
  }
};

// export const approveReturn = async (req, res) => {
//   try {
//     const { orderId, itemId } = req.params;

//     const order = await Order.findById(orderId).populate("user");
//     if (!order) return res.status(404).send("Order not found");

//     const item = order.items.id(itemId);
//     if (!item) return res.status(404).send("Item not found");

//     // Ensure only return-requested items can be approved
//     if (item.status !== "return-requested") {
//       return res.status(400).send("Return cannot be approved");
//     }

//     // Calculate refund amount
//     const refundAmount = item.price * item.quantity;

//     // Wallet update
//     const user = await User.findById(order.user._id);
//     if (!user.wallet) {
//       user.wallet = { balance: 0, transactions: [] };
//     }

//     // Add refund to wallet
//     user.wallet.balance += refundAmount;

//     user.wallet.transactions.push({
//       type: "credit",
//       amount: refundAmount,
//       description: `Refund for Order ${order.orderId}`,
//       date: new Date()
//     });

//     await user.save();

//     // Update item status
//     item.status = "return-approved";
//     item.returnApprovedDate = new Date();

//     // Restore product stock
//     const product = await Product.findById(item.product);
//     const variant = product.variants[item.variantIndex];

//     variant.stock += item.quantity;
//     product.markModified(`variants.${item.variantIndex}.stock`);
//     await product.save();

//     await order.save();

//     res.redirect("/admin/returns");

//   } catch (err) {
//     console.log("Approve Return Error:", err);
//     res.status(500).send("Server Error");
//   }
// };



export const approveReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/returns");

    const item = order.items.id(itemId);
    if (!item) return res.redirect("/admin/returns");

    // Only return-requested items
    if (item.status !== "return-requested") {
      return res.redirect("/admin/returns");
    }

    // -------------------------------------
    // 1️⃣ UPDATE ITEM STATUS
    // -------------------------------------
    item.status = "returned";
    item.returnApprovedDate = new Date();

    // -------------------------------------
    // 2️⃣ RESTOCK PRODUCT
    // -------------------------------------
    const product = await Product.findById(item.product);

    if (product && product.variants[item.variantIndex]) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save();
    }

    // -------------------------------------
    // 3️⃣ REFUND INTO WALLET
    // -------------------------------------
    const userId = order.user;
    const refundAmount = item.price * item.quantity;

    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        transactions: []
      });
    }

    wallet.balance += refundAmount;

    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      description: `Refund for returned item (${item.product})`,
      date: new Date()
    });

    await wallet.save();

    await order.save();

    return res.redirect("/admin/returns");

  } catch (err) {
    console.error("Approve Return Error:", err);
    res.redirect("/admin/returns");
  }
};

// export const rejectReturn = async (req, res) => {
//   try {
//     const { orderId, itemId } = req.params;

//     const order = await Order.findById(orderId);
//     const item = order.items.id(itemId);

//     item.status = "return-rejected";
//     item.returnRejectedDate = new Date();

//     await order.save();

//     res.redirect("/admin/returns");

//   } catch (err) {
//     console.log("Reject Return Error:", err);
//     res.status(500).send("Server Error");
//   }
// };

export const rejectReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);
    const item = order.items.id(itemId);

    item.status = "return-rejected";
    item.returnRejectReason = "Return request rejected by admin";

    await order.save();

    return res.redirect("/admin/orders/returns");
  } catch (err) {
    console.error(err);
    res.status(500).send("Reject return error");
  }
};









