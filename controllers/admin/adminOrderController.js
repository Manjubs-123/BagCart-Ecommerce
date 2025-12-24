import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Wallet from "../../models/walletModel.js";
import { calculateRefundOldWay } from "../../utils/orderPricingUtils.js";
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
  // Restore stock
  const product = await Product.findById(item.product).session(session);
  if (product && product.variants && item.variantIndex != null) {
    product.variants[item.variantIndex].stock = round2(
      Number(product.variants[item.variantIndex].stock || 0) + 
      Number(item.quantity || 0)
    );
    product.markModified(`variants.${item.variantIndex}.stock`);
    await product.save({ session });
  }

  // Calculate refund using centralized function
  const refundAmount = calculateItemRefund(order, item, itemId);

  if (refundAmount > 0 && !item.refundAmount) {
    if (
      (order.paymentMethod === "razorpay" && order.paymentStatus === "paid") ||
      order.paymentMethod === "wallet"
    ) {
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
        //  ADD THIS BLOCK (ONLY THIS)
  if (order.paymentMethod === "cod") {
    const product = await Product.findById(item.product).session(session);

    if (product && product.variants && item.variantIndex != null) {
      product.variants[item.variantIndex].stock -= item.quantity;

      if (product.variants[item.variantIndex].stock < 0) {
        product.variants[item.variantIndex].stock = 0;
      }

      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
    }
  }
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, itemId } = req.params;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: LOAD ORDER & ITEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const order = await Order.findById(orderId)
      .populate("user")
      .session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Return item not found" });
    }

    if (item.status !== "return-requested") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Item is not in return-requested state"
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: RESTORE STOCK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const product = await Product.findById(item.product).session(session);
    if (product && product.variants[item.variantIndex]) {
      product.variants[item.variantIndex].stock += item.quantity;
      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  STEP 3: CALCULATE REFUND (SAME AS CANCEL)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let refundAmount = 0;

    //  OPTION 1: If breakdown was saved (NEW ORDERS)
    if (item.itemFinalPayable !== undefined && item.itemFinalPayable > 0) {
      refundAmount = item.itemFinalPayable;
      
      console.log("Using saved breakdown for return refund:", {
        itemSubtotal: item.itemSubtotal,
        couponShare: item.itemCouponShare,
        afterCoupon: item.itemAfterCoupon,
        taxShare: item.itemTaxShare,
        shippingShare: item.itemShippingShare,
        finalPayable: item.itemFinalPayable
      });
    } 
    //  OPTION 2: OLD ORDERS without breakdown (FALLBACK)
    else {
      console.log(" No breakdown found, using old calculation method");
      refundAmount = calculateRefundOldWay(order, item, itemId);
    }

    //  Safety cap: Cannot exceed remaining refundable amount
    const previousRefunds = order.items.reduce(
      (sum, i) => sum + (i.refundAmount || 0),
      0
    );
    const refundableRemaining = order.totalAmount - previousRefunds;
    refundAmount = Math.min(refundAmount, refundableRemaining);
    refundAmount = Math.max(0, +refundAmount.toFixed(2));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: CREDIT TO WALLET
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const userIdForWallet = order.user._id || order.user;
    let wallet = await Wallet.findOne({ user: userIdForWallet }).session(session);

    if (!wallet) {
      wallet = (await Wallet.create([{
        user: userIdForWallet,
        balance: 0,
        transactions: []
      }], { session }))[0];
    }
    console.log(refundAmount)
    wallet.balance += refundAmount;
    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      description: `Return refund for item ${item.itemOrderId ||order.orderId}`,
      date: new Date(),
      meta: {
        itemSubtotal: item.itemSubtotal?.toFixed(2),
        couponShare: item.itemCouponShare?.toFixed(2),
        itemAfterCoupon: item.itemAfterCoupon?.toFixed(2),
        taxShare: item.itemTaxShare?.toFixed(2),
        shippingShare: item.itemShippingShare?.toFixed(2),
        refundAmount: refundAmount.toFixed(2)
      }
    });

    await wallet.save({ session });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: MARK AS RETURNED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    item.status = "returned";
    item.returnApprovedDate = new Date();
    item.refundAmount = refundAmount;
    item.refundMethod = "wallet";
    item.refundStatus = "credited";
    item.refundDate = new Date();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: UPDATE ORDER STATUS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allReturned = order.items.every(i =>
      ["cancelled", "returned"].includes(i.status)
    );

    if (allReturned) {
      order.orderStatus = "cancelled";
      order.paymentStatus = "refunded";
    } else {
      const anyRefunded = order.items.some(i => i.refundAmount > 0);
      if (anyRefunded) {
        order.paymentStatus = "partial_refunded";
      }
    }

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "Return approved and refund processed successfully",
      refundAmount: refundAmount,
      breakdown: {
        itemSubtotal: item.itemSubtotal,
        couponDiscount: item.itemCouponShare,
        itemAfterCoupon: item.itemAfterCoupon,
        tax: item.itemTaxShare,
        shipping: item.itemShippingShare,
        totalRefund: refundAmount
      }
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Approve Return Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while approving return",
      error: err.message
    });
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










