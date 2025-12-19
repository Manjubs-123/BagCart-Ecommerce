import mongoose from "mongoose";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js";
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
// export const createOrder = async (req, res) => {
//   try {
//     const userId = req.session.user.id;
//     const { addressId, paymentMethod } = req.body;

//     if (!addressId && !paymentMethod) {
//       return res.json({
//         success: false,
//         message: "Please select a delivery address and payment method"
//       });
//     }

//     if (!addressId) {
//       return res.json({
//         success: false,
//         message: "Delivery address is not selected"
//       });
//     }

//     if (!paymentMethod) {
//       return res.json({
//         success: false,
//         message: "Payment method is not selected"
//       });
//     }


//     const cart = await Cart.findOne({ user: userId })
//       .populate("items.product");

//     if (!cart || cart.items.length === 0) {
//       return res.json({ success: false, message: "Cart empty" });
//     }

//     const user = await User.findById(userId);
//     const address = user.addresses.id(addressId);

//     if (!address) {
//       return res.json({ success: false, message: "Address not found" });
//     }
// //apply offer to each item
//     for (let item of cart.items) {
//       const variant = item.product.variants[item.variantIndex];

//       const offerData = await applyOfferToProduct({
//         ...item.product.toObject(),
//         variants: [variant]
//       });

//       const offerVariant = offerData.variants[0];//extract calculated varient price

//       item._finalPrice = offerVariant.finalPrice;
//       item._regularPrice = offerVariant.regularPrice;
//     }
// //build order items 
//     const orderItems = cart.items.map(item => {
//       const variant = item.product.variants[item.variantIndex];

//       return {
//         product: item.product._id,
//         variantIndex: item.variantIndex,
//         quantity: item.quantity,

//         price: item._finalPrice,
//         regularPrice: item._regularPrice,

//         color: variant.color,
//         image: variant.images?.[0]?.url || ""
//       };
//     });



// //price calculation
//     const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
 
//     const tax = subtotal * 0.1;
//     const shippingFee = subtotal > 500 ? 0 : 50;
//     const totalAmount = subtotal + tax + shippingFee;

//     const customOrderId = generateOrderId();

//     const order = await Order.create({
//       orderId: customOrderId,
//       user: userId,
//       items: orderItems,
//       shippingAddress: address,
//       paymentMethod,
//       subtotal,
//       tax,
//       shippingFee,
//       totalAmount,
//       paymentStatus:
//         paymentMethod === "cod"
//           ? "pending"
//           : paymentMethod === "wallet"
//             ? "paid"
//             : "pending"
//     });
// //update stock
//     for (let item of cart.items) {
//       const product = await Product.findById(item.product._id);
//       if (!product) continue;

//       product.variants[item.variantIndex].stock -= item.quantity;
//       product.markModified(`variants.${item.variantIndex}.stock`);
//       await product.save();
//     }

//     cart.items = [];
//     await cart.save();

//     return res.json({
//       success: true,
//       orderId: order._id,
//       customOrderId: order.orderId
//     });

//   } catch (err) {
//     console.error("ORDER ERROR:", err);
//     return res.json({ success: false, message: "Order failed" });
//   }
// };


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
        subtotalBeforeCoupon: subtotalBeforeCoupon // ✅ NEW: Save original subtotal
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
    // ✅✅✅ STEP 5: MAGIC PART - DISTRIBUTE COSTS TO ITEMS ✅✅✅
    // This calculates HOW MUCH coupon/tax/shipping belongs to each item
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    distributeOrderCostsToItems(
      orderItems,
      subtotalBeforeCoupon,
      couponDiscount,
      totalTax,
      shippingFee
    );

    // ✅ SINGLE SOURCE OF TRUTH — NO FLOAT DRIFT
const totalAmount = Number(
  orderItems
    .reduce((sum, item) => sum + item.itemFinalPayable, 0)
    .toFixed(2)
);


    // ✅ Safety check: Make sure totals match
 const sumCheck = Number(
  orderItems
    .reduce((sum, item) => sum + item.itemFinalPayable, 0)
    .toFixed(2)
);

const orderTotalRounded = Number(totalAmount.toFixed(2));

if (Math.abs(sumCheck - totalAmount) > 0.001) {

  console.error("⚠️ Item totals don't match order total!", {
    sumCheck,
    orderTotalRounded
  });
  await session.abortTransaction();
  session.endSession();
  return res.status(500).json({
    success: false,
    message: "Order calculation error. Please try again."
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: CREATE ORDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const order = await Order.create([{
      orderId: "BH-" + Math.floor(100000 + Math.random() * 900000),
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 8: STOCK DEDUCTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product._id).session(session);
      if (!product) continue;

      const variant = product.variants[cartItem.variantIndex];
      if (!variant) continue;

      variant.stock = Math.max(0, variant.stock - cartItem.quantity);
      product.markModified(`variants.${cartItem.variantIndex}.stock`);
      await product.save({ session });
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🔥 HELPER FUNCTION - ADD THIS AT THE BOTTOM OF YOUR FILE
   
   This function splits the coupon, tax, and shipping across all items
   So each item knows EXACTLY how much the user paid for it
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// function distributeOrderCostsToItems(
//   items,
//   subtotalBeforeCoupon,
//   couponDiscount,
//   totalTax,
//   shippingFee
// ) {
//   const numItems = items.length;
  
//   // STEP 1: Split coupon across items proportionally
//   let remainingCoupon = couponDiscount;
  
//   for (let i = 0; i < numItems; i++) {
//     const item = items[i];
    
//     if (i === numItems - 1) {
//       // Last item gets whatever is left (handles rounding)
//       item.itemCouponShare = +remainingCoupon.toFixed(2);
//     } else {
//       // Calculate this item's share based on its price
//       const ratio = item.itemSubtotal / subtotalBeforeCoupon;
//       item.itemCouponShare = +(couponDiscount * ratio).toFixed(2);
//       remainingCoupon -= item.itemCouponShare;
//     }
    
//     item.itemAfterCoupon = +(item.itemSubtotal - item.itemCouponShare).toFixed(2);
//   }
  
//   // STEP 2: Split tax across items proportionally
//   const subtotalAfterCoupon = items.reduce((sum, item) => sum + item.itemAfterCoupon, 0);
//   let remainingTax = totalTax;
  
//   for (let i = 0; i < numItems; i++) {
//     const item = items[i];
    
//     if (i === numItems - 1) {
//       item.itemTaxShare = +remainingTax.toFixed(2);
//     } else {
//       const ratio = subtotalAfterCoupon > 0 ? item.itemAfterCoupon / subtotalAfterCoupon : 0;
//       item.itemTaxShare = +(totalTax * ratio).toFixed(2);
//       remainingTax -= item.itemTaxShare;
//     }
//   }
  
//   // STEP 3: Shipping goes ONLY to the last item
//   for (let i = 0; i < numItems; i++) {
//     items[i].itemShippingShare = (i === numItems - 1) ? shippingFee : 0;
//   }
  
//   // STEP 4: Calculate final amount user paid for each item
//   for (const item of items) {
//     item.itemFinalPayable = +(
//       item.itemAfterCoupon + 
//       item.itemTaxShare + 
//       item.itemShippingShare
//     ).toFixed(2);
//   }
// }


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


// export const downloadInvoice = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const userId = req.session.user?.id;

//     const order = await Order.findOne({ _id: orderId, user: userId })
//       .populate("items.product")
//       .lean();

//     if (!order) return res.status(404).send("Order not found");

//     const displayOrderId = order.orderId || order._id;
//     const fileName = `Invoice-${displayOrderId}.pdf`;

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

//     const doc = new PDFDocument({ margin: 40 });
//     const fontPath = path.join(__dirname, "../../public/fonts/DejaVuSans.ttf");

//     doc.registerFont("Unicode", fontPath);
//     doc.font("Unicode");
//     doc.pipe(res);

//     // HEADER
//     doc.fontSize(22).text("BagHub", { align: "center" });
//     doc.moveDown();
//     doc.fontSize(16).text("INVOICE", { align: "center" });
//     doc.moveDown(2);

//     // ORDER INFO
//     doc.fontSize(12).text(`Order ID: ${displayOrderId}`);
//     doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
//     doc.moveDown(1);

//     // SHIPPING ADDRESS
//     const sa = order.shippingAddress;
//     doc.text("Shipping Address:", { underline: true });
//     doc.text(sa.fullName);
//     doc.text(sa.addressLine1);
//     if (sa.addressLine2) doc.text(sa.addressLine2);
//     doc.text(`${sa.city}, ${sa.state} - ${sa.pincode}`);
//     doc.text(`Phone: ${sa.phone}`);
//     doc.moveDown(1);

//     // ITEMS TABLE
//     doc.fontSize(12).text("Order Items:", { underline: true });
//     doc.moveDown(0.5);

//     order.items.forEach((item, index) => {
//       const itemOrderId = item.itemOrderId || `${displayOrderId}-${index + 1}`;

//       doc.text(`Item ${index + 1}:`);
//       doc.text(`Item Order ID: ${itemOrderId}`);
//       doc.text(`Product: ${item.product?.name}`);
//       doc.text(`Color: ${item.color}`);
//       doc.text(`Quantity: ${item.quantity}`);
//       doc.text(`Unit Price: ₹${item.price}`);
//       doc.text(`Item Total: ₹${(item.price * item.quantity).toFixed(2)}`);
//       doc.moveDown(1);
//     });

//     // ORDER TOTALS
//     doc.text(`Subtotal: ₹${order.subtotal.toFixed(2)}`);
//     if (order.coupon?.discountAmount > 0) {
//       doc.text(`Coupon Discount: -₹${order.coupon.discountAmount.toFixed(2)}`);
//     }
//     doc.text(`Tax: ₹${order.tax.toFixed(2)}`);
//     doc.text(`Shipping: ₹${order.shippingFee.toFixed(2)}`);
//     doc.moveDown();

//     doc.fontSize(14).text(`Grand Total: ₹${order.totalAmount.toFixed(2)}`);
//     doc.moveDown();

//     doc.end();

//   } catch (err) {
//     console.error("downloadInvoice Error:", err);
//     res.status(500).send("Could not generate invoice");
//   }
// };


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
    doc.text("Qty", 300, doc.y - 12);
    doc.text("Price", 350, doc.y - 12);
    doc.text("Total", 420, doc.y - 12);

    doc.moveTo(leftX, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    order.items.forEach((item) => {
      const lineY = doc.y;

      doc.text(item.product?.name, leftX, lineY, { width: 240 });
      doc.text(item.quantity.toString(), 300, lineY);
      doc.text(`₹${item.price}`, 350, lineY);
      doc.text(
        `₹${(item.price * item.quantity).toFixed(2)}`,
        420,
        lineY
      );

      doc.moveDown(0.5);
    });

    doc.moveDown(2);

    /* ---------------- TOTALS (RIGHT ALIGNED, CLEAN) ---------------- */
    y = doc.y;
    const totalX = 350;

    doc.text(`Subtotal: ₹${order.subtotal.toFixed(2)}`, totalX, y);
    y += 14;

    if (order.coupon?.discountAmount > 0) {
      doc.text(
        `Coupon Discount: -₹${order.coupon.discountAmount.toFixed(2)}`,
        totalX,
        y
      );
      y += 14;
    }

    doc.text(`Tax: ₹${order.tax.toFixed(2)}`, totalX, y);
    y += 14;
    doc.text(`Shipping: ₹${order.shippingFee.toFixed(2)}`, totalX, y);
    y += 18;

    doc.fontSize(13).text(
      `Grand Total: ₹${order.totalAmount.toFixed(2)}`,
      totalX,
      y
    );

    doc.end();
  } catch (err) {
    console.error("downloadInvoice Error:", err);
    res.status(500).send("Could not generate invoice");
  }
};


// export const cancelItem = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { orderId, itemId } = req.params;
//     const { reason, details } = req.body;
//     const userId = req.session?.user?.id;

//     if (!userId) {
//       return res.status(401).json({ success: false, message: "Not logged in" });
//     }

//     const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
//     if (!order) throw new Error("Order not found");

//     const item = order.items.id(itemId);
//     if (!item) throw new Error("Item not found");

//     if (["cancelled", "returned", "delivered"].includes(item.status)) {
//       return res.json({ success: false, message: "Cannot cancel this item" });
//     }

//     /* ---------------- STOCK RESTORE ---------------- */
//     const product = await Product.findById(item.product).session(session);
//     if (product?.variants?.[item.variantIndex]) {
//       product.variants[item.variantIndex].stock += item.quantity;
//       await product.save({ session });
//     }

//     /* ---------------- MARK CANCELLED ---------------- */
//     item.status = "cancelled";
//     item.cancelReason = reason || "Cancelled by user";
//     item.cancelDetails = details || "";
//     item.cancelledDate = new Date();

//     /* ---------------- PREPAID CHECK ---------------- */
//     const isPrepaid =
//       order.paymentMethod === "wallet" ||
//       (order.paymentMethod === "razorpay" &&
//         ["paid", "partial_refunded"].includes(order.paymentStatus));

//     /* ---------------- REFUND BLOCK ---------------- */
//     if (isPrepaid && !item.refundAmount) {

//       const itemPrice = Number(item.price);
//       const itemQty = Number(item.quantity);
//       const itemTotal = itemPrice * itemQty;

//       // COUPON SHARE 
//       let itemCouponShare = 0;

//       if (order.coupon && order.coupon.discountAmount > 0) {
//         const baseSubtotal = order.coupon.subtotalBeforeCoupon || order.subtotal;

//         if (baseSubtotal > 0) {

//           itemCouponShare = (itemTotal / baseSubtotal) * order.coupon.discountAmount;
//         }
//       }

//       const itemAfterCoupon = Math.max(0, itemTotal - itemCouponShare);

//       /* --------- TAX SHARE  -------- */
//       let itemTaxShare = 0;

//       // Tax is calculated on (subtotal - coupon)
//       const totalAfterCoupon = order.subtotal - (order.coupon?.discountAmount || 0);

//       if (totalAfterCoupon > 0 && order.tax > 0) {
//         itemTaxShare = (itemAfterCoupon / totalAfterCoupon) * order.tax;
//       }

//       /* --------- SHIPPING REFUND  -------- */
//       let itemShippingShare = 0;

//       const otherItems = order.items.filter(i => i._id.toString() !== itemId);
//       const allOthersDone = otherItems.every(i =>
//         ["cancelled", "returned"].includes(i.status)
//       );

//       // Refund full shipping
//       if (order.items.length === 1 || allOthersDone) {
//         itemShippingShare = order.shippingFee;
//       }

//       /* --------- FINAL REFUND AMOUNT -WHAT USER ACTUALLY PAID -------- */
//       let refundAmount = itemAfterCoupon + itemTaxShare + itemShippingShare;

//       //  Cannot exceed remaining refundable amount 
//       const previousRefunds = order.items.reduce(
//         (sum, i) => sum + (i.refundAmount || 0),
//         0
//       );
//       const refundableRemaining = order.totalAmount - previousRefunds;

//       refundAmount = Math.min(refundAmount, refundableRemaining);
//       refundAmount = Math.max(0, refundAmount); // Cannot be negative
//       refundAmount = +refundAmount.toFixed(2);

//       // WALLET UPDATE 
//       let wallet = await Wallet.findOne({ user: userId }).session(session);
//       if (!wallet) {
//         wallet = (await Wallet.create([{
//           user: userId,
//           balance: 0,
//           transactions: []
//         }], { session }))[0];
//       }

//       wallet.balance += refundAmount;
//       wallet.transactions.push({
//         type: "credit",
//         amount: refundAmount,
//         description: `Refund for cancelled item ${item.itemOrderId || itemId}`,
//         date: new Date(),
//         meta: {
//           itemTotal: itemTotal.toFixed(2),
//           couponShare: itemCouponShare.toFixed(2),
//           itemAfterCoupon: itemAfterCoupon.toFixed(2),
//           taxShare: itemTaxShare.toFixed(2),
//           shippingShare: itemShippingShare.toFixed(2),
//           refundAmount: refundAmount.toFixed(2)
//         }
//       });

//       await wallet.save({ session });

//       //  SAVE REFUND INFO IN ITEM 
//       item.refundAmount = refundAmount;
//       item.refundMethod = "wallet";
//       item.refundStatus = "credited";
//       item.refundDate = new Date();
//     }

//    //  ORDER STATUS UPDATE 
//     const allCancelled = order.items.every(i =>
//       ["cancelled", "returned"].includes(i.status)
//     );

//     if (allCancelled) {
//       order.orderStatus = "cancelled";
//       order.paymentStatus = "refunded";
//     } else {
//       // At least one item cancelled/returned but not all
//       const anyRefunded = order.items.some(i => i.refundAmount > 0);
//       if (anyRefunded) {
//         order.paymentStatus = "partial_refunded";
//       }
//     }

//     await order.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({
//       success: true,
//       message: "Item cancelled successfully",
//       refundAmount: item.refundAmount || 0
//     });

//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Cancel Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Something went wrong",
//       error: err.message
//     });
//   }
// };


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
    // ✅✅✅ STEP 5: CALCULATE REFUND (THE MAGIC!) ✅✅✅
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let refundAmount = 0;

    if (isPrepaid && !item.refundAmount) {
      
      // 🎯 OPTION 1: If breakdown was saved (RECOMMENDED - NEW ORDERS)
      if (item.itemFinalPayable !== undefined && item.itemFinalPayable > 0) {
        // Simply use the saved amount!
        refundAmount = item.itemFinalPayable;
        
        console.log("✅ Using saved breakdown for refund:", {
          itemSubtotal: item.itemSubtotal,
          couponShare: item.itemCouponShare,
          afterCoupon: item.itemAfterCoupon,
          taxShare: item.itemTaxShare,
          shippingShare: item.itemShippingShare,
          finalPayable: item.itemFinalPayable
        });
      } 
      // 🎯 OPTION 2: OLD ORDERS without breakdown (FALLBACK)
      else {
        console.log("⚠️ No breakdown found, using old calculation method");
        refundAmount = calculateRefundOldWay(order, item, itemId);
      }

      // ✅ Safety cap: Cannot exceed remaining refundable amount
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
        description: `Refund for cancelled item ${item.itemOrderId || itemId}`,
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🔥 HELPER FUNCTION FOR OLD ORDERS - ADD THIS AT THE BOTTOM
   
   This is used for orders created BEFORE you added the breakdown
   It recalculates the refund the old way (less accurate but better than nothing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// function calculateRefundOldWay(order, item, itemId) {
//   const itemPrice = Number(item.price);
//   const itemQty = Number(item.quantity);
//   const itemTotal = itemPrice * itemQty;

//   // COUPON SHARE
//   let itemCouponShare = 0;
//   if (order.coupon && order.coupon.discountAmount > 0) {
//     const baseSubtotal = order.coupon.subtotalBeforeCoupon || order.subtotal;
//     if (baseSubtotal > 0) {
//       itemCouponShare = (itemTotal / baseSubtotal) * order.coupon.discountAmount;
//     }
//   }

//   const itemAfterCoupon = Math.max(0, itemTotal - itemCouponShare);

//   // TAX SHARE
//   let itemTaxShare = 0;
//   const totalAfterCoupon = order.subtotal - (order.coupon?.discountAmount || 0);
//   if (totalAfterCoupon > 0 && order.tax > 0) {
//     itemTaxShare = (itemAfterCoupon / totalAfterCoupon) * order.tax;
//   }

//   // SHIPPING REFUND
//   let itemShippingShare = 0;
//   const otherItems = order.items.filter(i => i._id.toString() !== itemId);
//   const allOthersDone = otherItems.every(i =>
//     ["cancelled", "returned"].includes(i.status)
//   );

//   if (order.items.length === 1 || allOthersDone) {
//     itemShippingShare = order.shippingFee;
//   }

//   // FINAL REFUND
//   return itemAfterCoupon + itemTaxShare + itemShippingShare;
// }

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

