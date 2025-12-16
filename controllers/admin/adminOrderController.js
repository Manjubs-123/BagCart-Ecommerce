import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Wallet from "../../models/walletModel.js";
import mongoose from "mongoose";

export const adminListOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { search, status, fromDate, toDate } = req.query;

    
    let filter = {};

  
    if (status && status !== "all") {
      const orderLevelStatuses = [
        "pending", "processing", "shipped",
        "out_for_delivery", "delivered"
      ];

      const itemLevelStatuses = [
        "cancelled", "return-requested", "returned"
      ];

      if (orderLevelStatuses.includes(status)) {
        filter.orderStatus = status;
      }
      else if (itemLevelStatuses.includes(status)) {
        filter.items = { $elemMatch: { status: status } };  
      }
    }

    
    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }

      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    
    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i");

      const orConditions = [
        { orderId: regex },
        { "items.itemOrderId": regex }
      ];

      
      if (mongoose.isValidObjectId(search)) {
        orConditions.push({
          "items._id": new mongoose.Types.ObjectId(search)
        });
      }

      if (!filter.$and) filter.$and = [];

      filter.$and.push({ $or: orConditions });
    }

    
   
   
    const totalOrders = await Order.countDocuments(filter);

    const deliveredOrders = await Order.countDocuments({
      ...filter,
      orderStatus: "delivered",
    });

    const cancelledOrders = await Order.countDocuments({
      ...filter,
      "items.status": "cancelled",
    });

    const inProgressOrders = await Order.countDocuments({
      ...filter,
      orderStatus: { $in: ["pending", "processing", "shipped", "out_for_delivery"] },
    });

    const returnCount = await Order.countDocuments({
      "items.status": "return-requested",
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
      returnCount,
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
      returnCount: 0,
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


export const adminUpdateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found");

    const prevStatus = item.status;

    const normalize = (s) =>
      s.toLowerCase().replace(/ /g, "_").replace(/-/g, "_").trim();

    const prev = normalize(prevStatus);
    const next = normalize(status);

    
   
const allowedFlow = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],        
  cancelled: [],       
  returned: []          
};



    
    if (!allowedFlow[prev] || !allowedFlow[prev].includes(next)) {
      throw new Error(`Cannot change status from '${prevStatus}' to '${status}'`);
    }

    item.status = next;


   
    // CANCEL BLOCK 
   
    if (next === "cancelled" && prev !== "cancelled" && prev !== "delivered") {

     
      const product = await Product.findById(item.product).session(session);

      if (product && product.variants && item.variantIndex != null) {
        product.variants[item.variantIndex].stock += item.quantity;
        await product.save({ session });
      }

    
      const refundAmount = item.price * item.quantity;

      if (
        (order.paymentMethod === "razorpay" && order.paymentStatus === "paid") ||
        order.paymentMethod === "wallet"
      ) {
        if (!item.refundAmount) {
          
          await Wallet.findOneAndUpdate(
            { user: order.user },
            {
              $inc: { balance: refundAmount },
              $push: {
                transactions: {
                  type: "credit",
                  amount: refundAmount,
                  description: `Refund for cancelled item ${item._id}`,
                  date: new Date()
                }
              }
            },
            { session, upsert: true }
          );

          item.refundAmount = refundAmount;
          item.refundStatus = "credited";
          item.refundMethod = "wallet";
          item.refundDate = new Date();
        }
      }
    }

    if (next === "delivered") {
      item.deliveredDate = new Date();
    }

    if (order.items.every((i) => i.status === "delivered")) {
      order.orderStatus = "delivered";
    }

if (order.orderStatus === "created") {
  order.orderStatus = "pending"; 
}

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.json({ success: true, message: "Item status updated", itemId });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("ADMIN UPDATE STATUS ERROR >>>", err);
    return res.status(500).json({ success: false, message: err.message });
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



export const approveReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { refundAmount, refundBase, refundTax, couponDeduction } = req.body;
    const now = new Date();

    const order = await Order.findById(orderId).populate("user");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Return item not found in order" });
    }

    if (item.status !== "return-requested") {
      return res.status(400).json({ success: false, message: "Item is not in return-requested state" });
    }

    let finalRefundAmount, taxAmount, actualCouponDeduction;

    if (refundAmount && refundBase && refundTax !== undefined) {
      finalRefundAmount = parseFloat(refundAmount);
      taxAmount = parseFloat(refundTax);
      actualCouponDeduction = couponDeduction ? parseFloat(couponDeduction) : 0;

    } else {
      
      const price = Number(item.price);
      const qty = Number(item.quantity);
      const itemTotal = price * qty;

      
      const baseSubtotal =
        order.coupon?.subtotalBeforeCoupon > 0
          ? order.coupon.subtotalBeforeCoupon 
          : order.subtotal;

      let couponShare = 0;
      if (order.coupon && order.coupon.discountAmount > 0) {
        const itemShare = baseSubtotal > 0 ? itemTotal / baseSubtotal : 0;
        couponShare = order.coupon.discountAmount * itemShare;
      }

      const computedRefundBase = Math.max(0, itemTotal - couponShare);
      taxAmount = computedRefundBase * 0.10;

     
      let shippingRefund = 0;

      
      const otherItems = order.items.filter(i => i._id.toString() !== itemId);
      const allOtherReturned = otherItems.every(i => i.status === "returned");

    
      if (allOtherReturned) {
        shippingRefund = order.shippingFee || 50;
      }

      finalRefundAmount = computedRefundBase + taxAmount + shippingRefund;
      actualCouponDeduction = couponShare;
    }

    
    const product = await Product.findById(item.product);
    if (product && product.variants[item.variantIndex]) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save();
    }

    
    const userId = order.user._id;
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        transactions: []
      });
    }

    wallet.balance += finalRefundAmount;
    wallet.transactions.push({
      type: "credit",
      amount: finalRefundAmount,
      description: `Return refund for item ${item.itemOrderId || itemId} (incl. tax & shipping if applicable)`,
      details: {
        couponDeduction: actualCouponDeduction.toFixed(2),
        taxAmount: taxAmount.toFixed(2)
      },
      date: now
    });

    item.status = "returned";
    item.returnApprovedDate = now;
    item.refundAmount = finalRefundAmount;
    item.refundedTax = taxAmount;

    await wallet.save();
    await order.save();

    return res.json({
      success: true,
      message: "Return approved and refund processed successfully",
      refund: finalRefundAmount,
      refundedTax: taxAmount,
      couponDeduction: actualCouponDeduction
    });

  } catch (err) {
    console.error("Approve Return Error:", err);
    return res.status(500).json({ success: false, message: "Server error while approving return" });
  }
};


export const rejectReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { rejectionReason } = req.body;


    if (
      !rejectionReason ||
      typeof rejectionReason !== "string" ||
      rejectionReason.trim().length < 5 ||
      !/[a-zA-Z]/.test(rejectionReason)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid rejection reason"
      });
    }
   

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    item.status = "return-rejected";
item.returnDetails = rejectionReason;     
item.returnRejectedDate = new Date(); 
    await order.save();

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Reject return error" });
  }
};










