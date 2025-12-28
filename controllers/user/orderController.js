import mongoose from "mongoose";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js";
import { buildOrderSummary } from "../../utils/orderSummaryUtils.js";
import {
  distributeOrderCostsToItems,calculateRefundOldWay
} from "../../utils/orderPricingUtils.js"

import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




const generateOrderId = () => {
  return "BH-" + Math.floor(100000 + Math.random() * 900000).toString();
};


export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.session.user?.id;
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const { addressId, paymentMethod, couponCode } = req.body;

    if (!addressId || !paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.json({
        success: false,
        message: "Delivery address and payment method required"
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: LOAD CART & APPLY OFFERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .session(session);

    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Cart is empty" });
    }

    const user = await User.findById(userId).session(session);
    const address = user.addresses.id(addressId);
    if (!address) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Address not found" });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: BUILD ORDER ITEMS WITH PRICES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let orderItems = [];
    let subtotalBeforeCoupon = 0;
const generatedOrderId = generateOrderId();

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const variant = product.variants[cartItem.variantIndex];

      if (!variant) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ success: false, message: "Variant not found" });
      }

      // Apply offers to get final price
      const offerData = await applyOfferToProduct({
        ...product.toObject(),
        variants: [variant]
      });

      const offerVariant = offerData?.variants?.[0] || {};
      const finalPrice = Number(offerVariant.finalPrice ?? variant.price);
      const regularPrice = Number(offerVariant.regularPrice ?? variant.mrp ?? variant.price);
      const qty = Number(cartItem.quantity);

      const itemSubtotal = finalPrice * qty;
      subtotalBeforeCoupon += itemSubtotal;

      orderItems.push({
        product: product._id,
        variantIndex: cartItem.variantIndex,
        quantity: qty,
        price: +finalPrice.toFixed(2), // Unit price
        regularPrice: +regularPrice.toFixed(2),
        itemSubtotal: +itemSubtotal.toFixed(2), // NEW: Total for this item
          itemOrderId: `${generatedOrderId}-${orderItems.length + 1}`,
        color: variant.color,
        image: variant.images?.[0]?.url || ""
      });
    }

    subtotalBeforeCoupon = +subtotalBeforeCoupon.toFixed(2);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: APPLY COUPON (IF ANY)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let couponDiscount = 0;
    let couponInfo = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true
      }).session(session);

      if (!coupon) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ success: false, message: "Invalid coupon" });
      }

      if (coupon.expiryDate < new Date()) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ success: false, message: "Coupon expired" });
      }

      if (subtotalBeforeCoupon < coupon.minOrderAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.json({
          success: false,
          message: `Minimum order ₹${coupon.minOrderAmount} required`
        });
      }

      const rawDiscount = (subtotalBeforeCoupon * coupon.discountValue) / 100;
      couponDiscount = Math.min(rawDiscount, coupon.maxDiscountAmount);
      couponDiscount = +couponDiscount.toFixed(2);

      couponInfo = {
        code: coupon.code,
        discountAmount: couponDiscount,
        subtotalBeforeCoupon: subtotalBeforeCoupon // NEW: Save original subtotal
      };
    }

    const subtotalAfterCoupon = subtotalBeforeCoupon - couponDiscount;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: CALCULATE TAX & SHIPPING
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const taxRate = 0.10; // 10% GST
    const totalTax = +(subtotalAfterCoupon * taxRate).toFixed(2);
    const shippingFee = subtotalBeforeCoupon > 500 ? 0 : 50;

   


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  STEP 5: MAGIC PART - DISTRIBUTE COSTS TO ITEMS 
    // This calculates HOW MUCH coupon/tax/shipping belongs to each item
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    distributeOrderCostsToItems(
      orderItems,
      subtotalBeforeCoupon,
      couponDiscount,
      totalTax,
      shippingFee
    );

    // SINGLE SOURCE OF TRUTH — NO FLOAT DRIFT
const totalAmount = Number(
  orderItems
    .reduce((sum, item) => sum + item.itemFinalPayable, 0)
    .toFixed(2)
);


    // Safety check: Make sure totals match
 const sumCheck = Number(
  orderItems
    .reduce((sum, item) => sum + item.itemFinalPayable, 0)
    .toFixed(2)
);

const orderTotalRounded = Number(totalAmount.toFixed(2));

if (Math.abs(sumCheck - totalAmount) > 0.001) {

  console.error(" Item totals don't match order total!", {
    sumCheck,
    orderTotalRounded
  });
  await session.abortTransaction();
  session.endSession();
return res.status(409).json({
  success: false,
  message: err.message || "Stock changed. Please review your cart."
});

}


console.log({
  orderTotal: totalAmount,
  itemsSum: orderItems.reduce((s, i) => s + i.itemFinalPayable, 0)
});


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: COD & WALLET CHECKS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (paymentMethod === "cod" && totalAmount > 1000) {
      await session.abortTransaction();
      session.endSession();
      return res.json({
        success: false,
        message: "COD not available above ₹1000"
      });
    }

    if (paymentMethod === "wallet") {
      const wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet || wallet.balance < totalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.json({
          success: false,
          message: "Insufficient wallet balance"
        });
      }
    }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FINAL STOCK LOCK VALIDATION (MANDATORY)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
for (const cartItem of cart.items) {
  const product = await Product.findById(cartItem.product._id).session(session);
  if (!product) {
    throw new Error("Product not found");
  }

  const variant = product.variants[cartItem.variantIndex];
  if (!variant) {
    throw new Error("Variant not found");
  }

  if (variant.stock < cartItem.quantity) {
   await session.abortTransaction();
session.endSession();

return res.status(409).json({
  success: false,
  message: `Stock changed for ${product.name}. Only ${variant.stock} left. Please review your cart.`
});

  }
}



    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: CREATE ORDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const order = await Order.create([{
orderId: generatedOrderId,
      user: userId,
      items: orderItems, // Now has breakdown for each item!
      shippingAddress: address,
      paymentMethod,
      subtotal: subtotalBeforeCoupon,
      tax: totalTax,
      shippingFee,
      totalAmount,
      coupon: couponInfo,
      paymentStatus: paymentMethod === "wallet" ? "paid" : "pending",
      orderStatus: "pending"
    }], { session });

    //  STEP X: INCREMENT COUPON USAGE COUNT
if (couponCode) {
  await Coupon.updateOne(
    { code: couponCode.toUpperCase() },
    { $inc: { usedCount: 1 } },
    { session }
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 8: STOCK DEDUCTION (ONLY FOR COD & WALLET)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if (paymentMethod === "cod" || paymentMethod === "wallet") {
  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.product._id).session(session);
    if (!product) continue;

    const variant = product.variants[cartItem.variantIndex];
    if (!variant) continue;

    if (variant.stock < cartItem.quantity) {
      throw new Error("Insufficient stock");
    }

    variant.stock -= cartItem.quantity;
    product.markModified(`variants.${cartItem.variantIndex}.stock`);
    await product.save({ session });
  }
}


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 9: WALLET DEDUCTION (IF WALLET PAYMENT)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (paymentMethod === "wallet") {
      const wallet = await Wallet.findOne({ user: userId }).session(session);
      wallet.balance -= totalAmount;
      wallet.transactions.push({
        type: "debit",
        amount: totalAmount,
        description: `Order ${order[0].orderId}`,
        date: new Date()
      });
      await wallet.save({ session });

      order[0].orderStatus = "confirmed";
      await order[0].save({ session });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 10: CLEAR CART
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      orderId: order[0]._id,
      customOrderId: order[0].orderId,
      totalAmount: order[0].totalAmount,
      razorpayAmount: paymentMethod === "razorpay" ? order[0].totalAmount * 100 : null,
      paymentPending: paymentMethod === "razorpay"
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("ORDER CREATION ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Order failed",
      error: err.message
    });
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
//calculate order level totals
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
      // Fix missing itemOrderId
      const fixedItems = order.items.map((item, index) => ({
        ...item,
        itemOrderId: item.itemOrderId || `${order.orderId}-${index + 1}`
      }));

      //  ADD THIS: Attach dynamic summary
      const summary = buildOrderSummary({
        ...order,
        items: fixedItems
      });

      return {
        ...order,
        items: fixedItems,
        summary // ← NEW: Attach calculated summary
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

    //  Calculate dynamic summary (accounts for cancellations/returns)
    const summary = buildOrderSummary(order);

    const displayOrderId = order.orderId || order._id;
    const fileName = `Invoice-${displayOrderId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 40 });
    const fontPath = path.join(__dirname, "../../public/fonts/DejaVuSans.ttf");

    doc.registerFont("Unicode", fontPath);
    doc.font("Unicode");
    doc.pipe(res);

    /* ---------------- HEADER ---------------- */
    doc.fontSize(20).text("BagHub", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text("INVOICE", { align: "center" });
    doc.moveDown(2);

    /* ---------------- ORDER INFO (2 COLUMN) ---------------- */
    const leftX = 40;
    const rightX = 330;
    let y = doc.y;

    doc.fontSize(11);
    doc.text(`Order ID: ${displayOrderId}`, leftX, y);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`, rightX, y);

    y += 14;
    doc.text(`Customer: ${order.shippingAddress.fullName}`, leftX, y);
    doc.text(`Payment: ${order.paymentMethod}`, rightX, y);

    doc.moveDown(2);

    /* ---------------- SHIPPING ADDRESS ---------------- */
    const sa = order.shippingAddress;
    doc.fontSize(11).text("Shipping Address", { underline: true });
    doc.moveDown(0.5);
    doc.text(sa.fullName);
    doc.text(sa.addressLine1);
    if (sa.addressLine2) doc.text(sa.addressLine2);
    doc.text(`${sa.city}, ${sa.state} - ${sa.pincode}`);
    doc.text(`Phone: ${sa.phone}`);

    doc.moveDown(2);

    /* ---------------- ITEMS (CLEAN LIST STRUCTURE) ---------------- */
    doc.fontSize(11).text("Order Items", { underline: true });
    doc.moveDown(0.5);

    // Header line
    doc.text("Product", leftX);
    doc.text("Qty", 280, doc.y - 12);
    doc.text("Price", 330, doc.y - 12);
    doc.text("Status", 400, doc.y - 12);
    doc.text("Total", 480, doc.y - 12);

    doc.moveTo(leftX, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    //  Display all items with their status
    order.items.forEach((item) => {
      const lineY = doc.y;
      const status = item.status || 'pending';
      
      // Display item details
      doc.text(item.product?.name || 'Unknown Product', leftX, lineY, { width: 220 });
      doc.text(item.quantity.toString(), 280, lineY);
      doc.text(`₹${item.price}`, 330, lineY);
      
      //  Show status with color coding
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);
      if (['cancelled', 'returned'].includes(status)) {
        doc.fillColor('red').text(statusText, 400, lineY);
        doc.fillColor('black');
        
        // Show refund amount if available
        if (item.refundAmount && item.refundAmount > 0) {
          doc.fillColor('green').text(`-₹${item.refundAmount.toFixed(2)}`, 480, lineY);
          doc.fillColor('black');
        } else {
          doc.text('₹0.00', 480, lineY);
        }
      } else {
        doc.text(statusText, 400, lineY);
        doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 480, lineY);
      }

      doc.moveDown(0.5);
    });

    doc.moveDown(2);

    /* ---------------- TOTALS (DYNAMIC - REFLECTS CANCELLATIONS/RETURNS) ---------------- */
    y = doc.y;
    const totalX = 350;

    //  Show active items subtotal (excludes cancelled/returned)
    doc.text(`Subtotal (Active Items): ₹${summary.activeItemsSubtotal.toFixed(2)}`, totalX, y);
    y += 14;

    // Show product discounts if any
    if (summary.productDiscounts > 0) {
      doc.fillColor('green')
        .text(`Product Discounts: -₹${summary.productDiscounts.toFixed(2)}`, totalX, y);
      doc.fillColor('black');
      y += 14;
    }

    // Show coupon discount for active items
    if (summary.activeCouponDiscount > 0) {
      doc.fillColor('green')
        .text(`Coupon Discount: -₹${summary.activeCouponDiscount.toFixed(2)}`, totalX, y);
      doc.fillColor('black');
      y += 14;
    }

    // Tax and shipping for active items
    doc.text(`Tax: ₹${summary.activeItemsTax.toFixed(2)}`, totalX, y);
    y += 14;
    doc.text(`Shipping: ₹${summary.activeItemsShipping.toFixed(2)}`, totalX, y);
    y += 18;

    //  Show cancelled/returned amounts if any
    if (summary.cancelledTotal > 0) {
      doc.fillColor('red')
        .text(`Cancelled Items Refund: -₹${summary.cancelledTotal.toFixed(2)}`, totalX, y);
      doc.fillColor('black');
      y += 14;
    }

    if (summary.returnedTotal > 0) {
      doc.fillColor('red')
        .text(`Returned Items Refund: -₹${summary.returnedTotal.toFixed(2)}`, totalX, y);
      doc.fillColor('black');
      y += 14;
    }

    // Add spacing before grand total
    if (summary.cancelledTotal > 0 || summary.returnedTotal > 0) {
      y += 6;
    }

    //  Show current payable amount (excludes refunded items)
    doc.fontSize(13)
      .text(`Current Amount Due: ₹${summary.grandTotal.toFixed(2)}`, totalX, y);
    
    y += 18;

    // Show original total if different from current
    if (Math.abs(summary.originalTotal - summary.grandTotal) > 0.01) {
      doc.fontSize(10)
        .fillColor('gray')
        .text(`(Original Total: ₹${summary.originalTotal.toFixed(2)})`, totalX, y);
      doc.fillColor('black');
    }

    /* ---------------- FOOTER NOTES ---------------- */
    if (summary.cancelledTotal > 0 || summary.returnedTotal > 0) {
      doc.moveDown(3);
      doc.fontSize(9)
        .fillColor('gray')
        .text('Note: Refunds have been processed to your wallet.', leftX, doc.y, { 
          width: 500, 
          align: 'left' 
        });
      doc.fillColor('black');
    }

    doc.end();
    return;
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
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: LOAD ORDER & ITEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
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

    if (["cancelled", "returned", "delivered"].includes(item.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Cannot cancel this item" });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: RESTORE STOCK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const product = await Product.findById(item.product).session(session);
    if (product?.variants?.[item.variantIndex]) {
      product.variants[item.variantIndex].stock += item.quantity;
      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: MARK AS CANCELLED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    item.status = "cancelled";
    item.cancelReason = reason || "Cancelled by user";
    item.cancelDetails = details || "";
    item.cancelledDate = new Date();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: CHECK IF PREPAID
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const isPrepaid =
      order.paymentMethod === "wallet" ||
      (order.paymentMethod === "razorpay" &&
        ["paid", "partial_refunded"].includes(order.paymentStatus));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  STEP 5: CALCULATE REFUND (THE MAGIC!) 
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let refundAmount = 0;

    if (isPrepaid && !item.refundAmount) {
      
      // OPTION 1: If breakdown was saved (RECOMMENDED - NEW ORDERS)
      if (item.itemFinalPayable !== undefined && item.itemFinalPayable > 0) {
        // Simply use the saved amount!
        refundAmount = item.itemFinalPayable;
        
        // console.log(" Using saved breakdown for refund:", {
        //   itemSubtotal: item.itemSubtotal,
        //   couponShare: item.itemCouponShare,
        //   afterCoupon: item.itemAfterCoupon,
        //   taxShare: item.itemTaxShare,
        //   shippingShare: item.itemShippingShare,
        //   finalPayable: item.itemFinalPayable
        // });
      } 
      //  OPTION 2: OLD ORDERS without breakdown (FALLBACK)
      else {
        // console.log(" No breakdown found, using old calculation method");
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
      // STEP 6: CREDIT TO WALLET
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
        description: `Refund for cancelled item ${item.itemOrderId || order.orderId}`,
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
      // STEP 7: SAVE REFUND INFO IN ITEM
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      item.refundAmount = refundAmount;
      item.refundMethod = "wallet";
      item.refundStatus = "credited";
      item.refundDate = new Date();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 8: UPDATE ORDER STATUS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allCancelled = order.items.every(i =>
      ["cancelled", "returned"].includes(i.status)
    );

    if (allCancelled) {
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
      message: "Item cancelled successfully",
      refundAmount: item.refundAmount || 0,
      breakdown: {
        itemSubtotal: item.itemSubtotal,
        couponDiscount: item.itemCouponShare,
        itemAfterCoupon: item.itemAfterCoupon,
        tax: item.itemTaxShare,
        shipping: item.itemShippingShare,
        totalRefund: item.refundAmount
      }
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

