import mongoose from "mongoose";
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Wallet from "../../models/walletModel.js";
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateOrderId = () => {
  return "BH-" + Math.floor(100000 + Math.random() * 900000).toString();
};
export const createOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { addressId, paymentMethod } = req.body;

    if (!addressId && !paymentMethod) {
      return res.json({
        success: false,
        message: "Please select a delivery address and payment method"
      });
    }

    if (!addressId) {
      return res.json({
        success: false,
        message: "Delivery address is not selected"
      });
    }

    if (!paymentMethod) {
      return res.json({
        success: false,
        message: "Payment method is not selected"
      });
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

    for (let item of cart.items) {
      const variant = item.product.variants[item.variantIndex];

      const offerData = await applyOfferToProduct({
        ...item.product.toObject(),
        variants: [variant]
      });

      const offerVariant = offerData.variants[0];

      item._finalPrice = offerVariant.finalPrice;
      item._regularPrice = offerVariant.regularPrice;
    }

    const orderItems = cart.items.map(item => {
      const variant = item.product.variants[item.variantIndex];

      return {
        product: item.product._id,
        variantIndex: item.variantIndex,
        quantity: item.quantity,

        price: item._finalPrice,
        regularPrice: item._regularPrice,

        color: variant.color,
        image: variant.images?.[0]?.url || ""
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.1;
    const shippingFee = subtotal > 500 ? 0 : 50;
    const totalAmount = subtotal + tax + shippingFee;

    const customOrderId = generateOrderId();

    const order = await Order.create({
      orderId: customOrderId,
      user: userId,
      items: orderItems,
      shippingAddress: address,
      paymentMethod,
      subtotal,
      tax,
      shippingFee,
      totalAmount,
      paymentStatus:
        paymentMethod === "cod"
          ? "pending"
          : paymentMethod === "wallet"
            ? "paid"
            : "pending"
    });

    for (let item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product) continue;

      product.variants[item.variantIndex].stock -= item.quantity;
      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save();
    }

    cart.items = [];
    await cart.save();

    return res.json({
      success: true,
      orderId: order._id,
      customOrderId: order.orderId
    });

  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res.json({ success: false, message: "Order failed" });
  }
};

export const getOrderConfirmation = async (req, res) => {
  try {
    const mongoOrderId = req.params.id;

    const order = await Order.findById(mongoOrderId)
      .populate({
        path: "items.product",
        select: "name brand variants images"
      })
      .lean();

    if (!order) return res.redirect("/order/orders");
    //     if (order.paymentStatus === "paid") {
    //   return res.redirect(`/order/success/${orderId}`);
    // }

    const items = order.items.map(item => {

      const variant = item.product && item.product.variants && item.product.variants[item.variantIndex];
      const storedPrice = item.price !== undefined ? Number(item.price) : (variant ? variant.price : 0);
      const storedRegular = item.regularPrice !== undefined ? Number(item.regularPrice) : (variant ? (variant.mrp || variant.price) : storedPrice);

      const qty = Number(item.quantity || 1);
      const totalFinal = storedPrice * qty;
      const totalRegular = storedRegular * qty;
      const itemSavings = Math.max(0, totalRegular - totalFinal);

      return {
        ...item,
        price: storedPrice,
        regularPrice: storedRegular,
        totalPrice: totalFinal,
        totalRegularPrice: totalRegular,
        itemSavings
      };
    });

    const totalRegularPrice = items.reduce((s, it) => s + (it.totalRegularPrice || 0), 0);
    const subtotal = Number(order.subtotal || items.reduce((s, it) => s + (it.totalPrice || 0), 0));
    const totalSavings = Math.max(0, totalRegularPrice - subtotal);

    const orderDisplayId = order.orderId;


    const orderForRender = {
      ...order,
      items,
      totalRegularPrice,
      totalSavings
    };

    res.render("user/orderConfirmation", {
      order: orderForRender,
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

    orders = orders.map(order => {
      const fixedItems = order.items.map((item, index) => ({
        ...item,
        itemOrderId: item.itemOrderId || `${order.orderId}-${index + 1}`
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
    const { orderId } = req.params;
    const userId = req.session.user?.id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("items.product")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    const displayOrderId = order.orderId || order._id;
    const fileName = `Invoice-${displayOrderId}.pdf`;

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

    // ORDER INFO
    doc.fontSize(12).text(`Order ID: ${displayOrderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.moveDown(1);

    // SHIPPING ADDRESS
    const sa = order.shippingAddress;
    doc.text("Shipping Address:", { underline: true });
    doc.text(sa.fullName);
    doc.text(sa.addressLine1);
    if (sa.addressLine2) doc.text(sa.addressLine2);
    doc.text(`${sa.city}, ${sa.state} - ${sa.pincode}`);
    doc.text(`Phone: ${sa.phone}`);
    doc.moveDown(1);

    // ITEMS TABLE
    doc.fontSize(12).text("Order Items:", { underline: true });
    doc.moveDown(0.5);

    order.items.forEach((item, index) => {
      const itemOrderId = item.itemOrderId || `${displayOrderId}-${index + 1}`;

      doc.text(`Item ${index + 1}:`);
      doc.text(`Item Order ID: ${itemOrderId}`);
      doc.text(`Product: ${item.product?.name}`);
      doc.text(`Color: ${item.color}`);
      doc.text(`Quantity: ${item.quantity}`);
      doc.text(`Unit Price: ₹${item.price}`);
      doc.text(`Item Total: ₹${(item.price * item.quantity).toFixed(2)}`);
      doc.moveDown(1);
    });

    // ORDER TOTALS
    doc.text(`Subtotal: ₹${order.subtotal.toFixed(2)}`);
    if (order.coupon?.discountAmount > 0) {
      doc.text(`Coupon Discount: -₹${order.coupon.discountAmount.toFixed(2)}`);
    }
    doc.text(`Tax: ₹${order.tax.toFixed(2)}`);
    doc.text(`Shipping: ₹${order.shippingFee.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(14).text(`Grand Total: ₹${order.totalAmount.toFixed(2)}`);
    doc.moveDown();

    doc.end();

  } catch (err) {
    console.error("downloadInvoice Error:", err);
    res.status(500).send("Could not generate invoice");
  }
};


export const cancelItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, itemId } = req.params;
    const { reason, details } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found");

    if (["cancelled", "returned", "delivered"].includes(item.status)) {
      return res.json({ success: false, message: "Cannot cancel this item" });
    }

    /* ---------------- STOCK RESTORE ---------------- */
    const product = await Product.findById(item.product).session(session);
    if (product?.variants?.[item.variantIndex]) {
      product.variants[item.variantIndex].stock += item.quantity;
      await product.save({ session });
    }

    /* ---------------- MARK CANCELLED ---------------- */
    item.status = "cancelled";
    item.cancelReason = reason || "Cancelled by user";
    item.cancelDetails = details || "";
    item.cancelledDate = new Date();

    /* ---------------- PREPAID CHECK ---------------- */
    const isPrepaid =
      order.paymentMethod === "wallet" ||
      (order.paymentMethod === "razorpay" &&
        ["paid", "partial_refunded"].includes(order.paymentStatus));

    /* ---------------- REFUND BLOCK (CORRECTED) ---------------- */
    if (isPrepaid && !item.refundAmount) {

      const itemPrice = Number(item.price);
      const itemQty = Number(item.quantity);
      const itemTotal = itemPrice * itemQty;

      /* --------- COUPON SHARE (CORRECTED FORMULA) -------- */
      let itemCouponShare = 0;

      if (order.coupon && order.coupon.discountAmount > 0) {
        const baseSubtotal = order.coupon.subtotalBeforeCoupon || order.subtotal;

        if (baseSubtotal > 0) {

          itemCouponShare = (itemTotal / baseSubtotal) * order.coupon.discountAmount;
        }
      }

      const itemAfterCoupon = Math.max(0, itemTotal - itemCouponShare);

      /* --------- TAX SHARE (CORRECTED) -------- */
      let itemTaxShare = 0;

      // Tax is calculated on (subtotal - coupon), so we need item's share of that
      const totalAfterCoupon = order.subtotal - (order.coupon?.discountAmount || 0);

      if (totalAfterCoupon > 0 && order.tax > 0) {
        itemTaxShare = (itemAfterCoupon / totalAfterCoupon) * order.tax;
      }

      /* --------- SHIPPING REFUND (ONLY ON LAST CANCEL) -------- */
      let itemShippingShare = 0;

      const otherItems = order.items.filter(i => i._id.toString() !== itemId);
      const allOthersDone = otherItems.every(i =>
        ["cancelled", "returned"].includes(i.status)
      );

      // Refund full shipping if this is the only item OR all others are cancelled/returned
      if (order.items.length === 1 || allOthersDone) {
        itemShippingShare = order.shippingFee;
      }

      /* --------- FINAL REFUND AMOUNT (WHAT USER ACTUALLY PAID) -------- */
      let refundAmount = itemAfterCoupon + itemTaxShare + itemShippingShare;

      /* --------- SAFETY CAP: Cannot exceed remaining refundable amount -------- */
      const previousRefunds = order.items.reduce(
        (sum, i) => sum + (i.refundAmount || 0),
        0
      );
      const refundableRemaining = order.totalAmount - previousRefunds;

      refundAmount = Math.min(refundAmount, refundableRemaining);
      refundAmount = Math.max(0, refundAmount); // Cannot be negative
      refundAmount = +refundAmount.toFixed(2);

      /* --------- WALLET UPDATE -------- */
      let wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet) {
        wallet = (await Wallet.create([{
          user: userId,
          balance: 0,
          transactions: []
        }], { session }))[0];
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        description: `Refund for cancelled item ${item.itemOrderId || itemId}`,
        date: new Date(),
        meta: {
          itemTotal: itemTotal.toFixed(2),
          couponShare: itemCouponShare.toFixed(2),
          itemAfterCoupon: itemAfterCoupon.toFixed(2),
          taxShare: itemTaxShare.toFixed(2),
          shippingShare: itemShippingShare.toFixed(2),
          refundAmount: refundAmount.toFixed(2)
        }
      });

      await wallet.save({ session });

      /* --------- SAVE REFUND INFO IN ITEM -------- */
      item.refundAmount = refundAmount;
      item.refundMethod = "wallet";
      item.refundStatus = "credited";
      item.refundDate = new Date();
    }

    /* ---------------- ORDER STATUS UPDATE ---------------- */
    const allCancelled = order.items.every(i =>
      ["cancelled", "returned"].includes(i.status)
    );

    if (allCancelled) {
      order.orderStatus = "cancelled";
      order.paymentStatus = "refunded";
    } else {
      // At least one item cancelled/returned but not all
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
      message: "Item cancelled successfully",
      refundAmount: item.refundAmount || 0
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Cancel Error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message
    });
  }
};




export const returnItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, details } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.json({ success: false, message: "Item not found" });
    }


    if (item.status === "cancelled") {
      return res.json({ success: false, message: "Cancelled items cannot be returned" });
    }

    if (item.status === "returned") {
      return res.json({ success: false, message: "Item already returned" });
    }

    if (item.status === "return-requested") {
      return res.json({ success: false, message: "Return already requested" });
    }


    if (item.status !== "delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }


    item.status = "return-requested";
    item.returnReason = reason;
    item.returnDetails = details || "";
    item.returnRequestedDate = new Date();

    await order.save();

    return res.json({
      success: true,
      message: "Return request submitted successfully"
    });

  } catch (error) {
    console.error("Return Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

