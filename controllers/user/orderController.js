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

        // Compute final & regular prices for each cart item
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

        // Save computed values into order
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
            paymentStatus: paymentMethod === "cod" ? "pending" : "paid"
        });

        // Reduce stock
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

    // Ensure each item has price & regularPrice (use stored values first)
    const items = order.items.map(item => {

      // if variant present, read fallback values
      const variant = item.product && item.product.variants && item.product.variants[item.variantIndex];
      const storedPrice = item.price !== undefined ? Number(item.price) : (variant ? variant.price : 0);
      const storedRegular = item.regularPrice !== undefined ? Number(item.regularPrice) : (variant ? (variant.mrp || variant.price) : storedPrice);

      // compute per-item totals
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

    // compute order-level regular total & total savings (for banner)
    const totalRegularPrice = items.reduce((s, it) => s + (it.totalRegularPrice || 0), 0);
    const subtotal = Number(order.subtotal || items.reduce((s, it) => s + (it.totalPrice || 0), 0));
    const totalSavings = Math.max(0, totalRegularPrice - subtotal);

    // use original custom display order id
    const orderDisplayId = order.orderId;

    // create a new object we will pass to EJS
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

    // Fix itemOrderId using custom orderId
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
    const { orderId, itemId } = req.params; 
    const userId = req.session.user?.id;

    console.log(" Download Invoice Request:", { orderId, itemId, userId });

    
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("items.product")
      .lean();

    if (!order) {
      console.log(" Order not found");
      return res.status(404).send("Order not found");
    }

    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) {
      console.log("Item not found");
      return res.status(404).send("Order item not found");
    }

    //  Use custom orderId for display
    const displayOrderId = order.orderId;
    const displayItemOrderId = item.itemOrderId || `${displayOrderId}-${order.items.indexOf(item) + 1}`;

    console.log(" Generating invoice for:", { displayOrderId, displayItemOrderId });

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
    console.error(" downloadInvoice Error:", err);
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

    /* ---------------- REFUND BLOCK ---------------- */
    if (isPrepaid && !item.refundAmount) {

      const price = Number(item.price);
      const qty = Number(item.quantity);
      const itemTotal = price * qty;

      /* --------- COUPON SHARE (MATCH RETURN LOGIC) -------- */
      const baseSubtotal =
        order.coupon?.subtotalBeforeCoupon > 0
          ? order.coupon.subtotalBeforeCoupon
          : order.subtotal;

      let couponShare = 0;
      if (order.coupon && order.coupon.discountAmount > 0 && baseSubtotal > 0) {
        const itemShare = itemTotal / baseSubtotal;
        couponShare = order.coupon.discountAmount * itemShare;
      }

      const refundBase = Math.max(0, itemTotal - couponShare);

      /* --------- TAX SHARE -------- */
      const taxShare =
        order.subtotal > 0
          ? (refundBase / order.subtotal) * order.tax
          : 0;

      /* --------- SHIPPING REFUND ONLY ON LAST CANCEL -------- */
      let shippingRefund = 0;

      const otherItems = order.items.filter(i => i._id.toString() !== itemId);
      const allOthersDone = otherItems.every(i =>
        ["cancelled", "returned"].includes(i.status)
      );

      if (order.items.length === 1 || allOthersDone) {
        shippingRefund = order.shippingFee;
      }

      /* --------- FINAL REFUND AMOUNT -------- */
      let refundAmount = refundBase + taxShare + shippingRefund;

      const previousRefunds = order.items.reduce(
        (sum, i) => sum + (i.refundAmount || 0),
        0
      );
      const refundableRemaining = order.totalAmount - previousRefunds;

      refundAmount = Math.min(refundAmount, refundableRemaining);
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
        description: `Refund for cancelled item ${item.itemOrderId}`,
        date: new Date(),
        meta: {
          refundBase: refundBase.toFixed(2),
          taxShare: taxShare.toFixed(2),
          shippingRefund: shippingRefund.toFixed(2),
          couponShare: couponShare.toFixed(2)
        }
      });

      await wallet.save({ session });

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
      order.paymentStatus = "partial_refunded";
    }

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "Item cancelled successfully"
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Cancel Error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong", error: err.message });
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

//     /* ---------------- PREPAID CHECK FIXED ---------------- */
//     const isPrepaid =
//       order.paymentMethod === "wallet" ||
//       (order.paymentMethod === "razorpay" &&
//        ["paid", "partial_refunded"].includes(order.paymentStatus));

//     /* ---------------- REFUND BLOCK ---------------- */
//     if (isPrepaid && !item.refundAmount) {

//       // const price = Number(item.price);
//       // const qty = Number(item.quantity);
//       // const itemTotal = price * qty;

//       /* --------- COUPON SHARE -------- */

//       /* ------------ COUPON SHARE (MATCHING RETURN LOGIC) ---------------- */
// const price = Number(item.price);
// const qty = Number(item.quantity);
// const itemTotal = price * qty;

// // Always use subtotalBeforeCoupon if available
// const baseSubtotal =
//   order.coupon?.subtotalBeforeCoupon > 0
//     ? order.coupon.subtotalBeforeCoupon
//     : order.subtotal;

// let couponShare = 0;

// if (order.coupon && order.coupon.discountAmount > 0 && baseSubtotal > 0) {
//   const itemShare = itemTotal / baseSubtotal;
//   couponShare = order.coupon.discountAmount * itemShare;
// }

// const refundBase = Math.max(0, itemTotal - couponShare);

//       // const baseSubtotal =
//       //   order.coupon?.subtotalBeforeCoupon || order.subtotal || 0;

//       // let couponShare = 0;
//       // if (order.coupon?.discountAmount > 0 && baseSubtotal > 0) {
//       //   couponShare = (itemTotal / baseSubtotal) * order.coupon.discountAmount;
//       // }

//       // const refundBase = itemTotal - couponShare;

//       /* --------- TAX SHARE -------- */
//       const taxShare =
//         order.subtotal > 0
//           ? (refundBase / order.subtotal) * order.tax
//           : 0;

//       /* --------- SHIPPING REFUND ONLY ON LAST CANCEL -------- */
//       let shippingRefund = 0;

//       const otherItems = order.items.filter(i => i._id.toString() !== itemId);
//       const allOthersDone = otherItems.every(i =>
//         ["cancelled", "returned"].includes(i.status)
//       );

//       if (order.items.length === 1 || allOthersDone) {
//         shippingRefund = order.shippingFee;
//       }

//       /* --------- FINAL REFUND -------- */
//       let refundAmount = refundBase + taxShare + shippingRefund;

//       const previousRefunds = order.items.reduce(
//         (sum, i) => sum + (i.refundAmount || 0),
//         0
//       );
//       const refundableRemaining = order.totalAmount - previousRefunds;

//       refundAmount = Math.min(refundAmount, refundableRemaining);
//       refundAmount = +refundAmount.toFixed(2);

//       /* --------- WALLET UPDATE -------- */
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
//         description: `Refund for cancelled item ${item.itemOrderId}`,
//         date: new Date(),
//         meta: {
//           refundBase: refundBase.toFixed(2),
//           taxShare: taxShare.toFixed(2),
//           shippingRefund: shippingRefund.toFixed(2),
//           couponShare: couponShare.toFixed(2)
//         }
//       });

//       await wallet.save({ session });

//       item.refundAmount = refundAmount;
//       item.refundMethod = "wallet";
//       item.refundStatus = "credited";
//       item.refundDate = new Date();
//     }

//     /* ---------------- ORDER STATUS FIX ---------------- */
//     const allCancelled = order.items.every(i =>
//       ["cancelled", "returned"].includes(i.status)
//     );

//     if (allCancelled) {
//       order.orderStatus = "cancelled";
//       order.paymentStatus = "refunded";
//     } else {
//       order.paymentStatus = "partial_refunded"; // <-- does not block second refund
//     }

//     await order.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({
//       success: true,
//       message: "Item cancelled successfully"
//     });

//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Cancel Error:", err);
//     return res.status(500).json({ success: false, message: "Something went wrong", error: err.message });
//   }
// };


// export const cancelItem = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { orderId, itemId } = req.params;
//     const { reason, details } = req.body;
//     const userId = req.session?.user?.id;
//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(401).json({ success: false, message: "Not logged in" });
//     }

//     const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
//     if (!order) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     const item = order.items.id(itemId);
//     if (!item) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({ success: false, message: "Item not found" });
//     }

//     if (["delivered", "cancelled", "returned"].includes(item.status)) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.json({ success: false, message: "Cannot cancel this item" });
//     }

//     // 1) Restore stock (best-effort; continue if it fails)
//     try {
//       const product = await Product.findById(item.product).session(session);
//       if (product && product.variants?.[item.variantIndex]) {
//         product.variants[item.variantIndex].stock += item.quantity;
//         await product.save({ session });
//       }
//     } catch (err) {
//       console.error("Stock return error:", err);
//       // continue — stock restore failure shouldn't block refund logic here
//     }

//     // 2) Mark item cancelled
//     item.status = "cancelled";
//     item.cancelReason = reason || "Cancelled by user";
//     item.cancelDetails = details || "";
//     item.cancelledDate = new Date();

//     // 3) Decide whether we must process refund to wallet
//     // Important: check payment METHOD (not status). We still prevent double-refund per-item by checking item.refundAmount
//     const isPrepaidMethod = ["razorpay", "wallet"].includes(order.paymentMethod);

//     if (isPrepaidMethod && !item.refundAmount) {
//       // compute item-level values (match order creation logic)
//       const price = Number(item.price || 0);
//       const qty = Number(item.quantity || 1);
//       const itemTotal = price * qty;

//       // coupon share (use subtotalBeforeCoupon if stored)
//       const baseSubtotal = Number(order.coupon?.subtotalBeforeCoupon ?? order.subtotal ?? 0);
//       let couponShare = 0;
//       if (order.coupon?.discountAmount > 0 && baseSubtotal > 0) {
//         const itemShare = itemTotal / baseSubtotal;
//         couponShare = (order.coupon.discountAmount || 0) * itemShare;
//       }

//       const refundBase = Math.max(0, itemTotal - couponShare);

//       // tax share proportional to refundBase (defensive)
//       const orderSubtotalSafe = Number(order.subtotal || 0);
//       const taxShare = orderSubtotalSafe > 0 ? (refundBase / orderSubtotalSafe) * Number(order.tax || 0) : 0;

//       // shipping refund rules
//       let shippingRefund = 0;

//       // If original order had only one item -> refund full shipping
//       if (order.items.length === 1) {
//         shippingRefund = Number(order.shippingFee || 0);
//       } else {
//         // multi-item: refund shipping only when all other items already cancelled/returned
//         const otherItems = order.items.filter(i => i._id.toString() !== itemId);
//         const allOtherDone = otherItems.length > 0 && otherItems.every(i => ["cancelled", "returned"].includes(i.status));
// // If this is the last item → refund remaining balance
// if (allOtherDone) {
//     const totalAlreadyRefunded = order.items
//         .filter(i => i.refundAmount && i._id.toString() !== itemId)
//         .reduce((sum, i) => sum + Number(i.refundAmount || 0), 0);

//     const remaining = order.totalAmount - totalAlreadyRefunded;

//     refundAmount = remaining;  // <-- FINAL FIX
// }
//       }

//       // Ensure we don't double-credit shipping — compute already-refunded shipping across other items (if any)
//       const alreadyShippingRefunded = order.items.reduce((acc, it) => {
//         if (it.refundMeta && Number(it.refundMeta.shippingRefund || 0) > 0) {
//           return acc + Number(it.refundMeta.shippingRefund || 0);
//         }
//         return acc;
//       }, 0);

//       // If shippingRefund > 0 but alreadyShippingRefunded covers it, zero it out
//       if (shippingRefund > 0 && alreadyShippingRefunded >= shippingRefund) {
//         shippingRefund = 0;
//       }

//       // Preliminary refund amount
//       let calculatedRefund = refundBase + taxShare + shippingRefund;

//       // Cap refund so cumulative refunds never exceed what user actually paid.
//       const alreadyRefundedTotal = order.items.reduce((s, it) => s + Number(it.refundAmount || 0), 0);
//       const orderTotalPaid = Number(order.totalAmount || 0);

//       const remainingRefundable = Math.max(0, orderTotalPaid - alreadyRefundedTotal);

//       // final refund amount is the min of calculatedRefund and remainingRefundable
//       let refundAmount = Math.min(calculatedRefund, remainingRefundable);
//       refundAmount = +refundAmount.toFixed(2);

//       // If refundAmount is zero (already fully refunded), skip wallet update
//       if (refundAmount > 0) {
//         // Find or create wallet within same session
//         let wallet = await Wallet.findOne({ user: userId }).session(session);
//         if (!wallet) {
//           const created = await Wallet.create([{
//             user: userId,
//             balance: 0,
//             transactions: []
//           }], { session });
//           wallet = created[0];
//         }

//         // credit wallet
//         wallet.balance = Number(wallet.balance || 0) + refundAmount;
//         wallet.transactions.push({
//           type: "credit",
//           amount: refundAmount,
//           description: `Refund for cancelled item ${item.itemOrderId || itemId}`,
//           meta: {
//             refundBase: (+refundBase).toFixed(2),
//             taxShare: (+taxShare).toFixed(2),
//             shippingRefund: (+shippingRefund).toFixed(2),
//             couponShare: (+couponShare).toFixed(2)
//           },
//           date: new Date()
//         });

//         await wallet.save({ session });

//         // mark item refund information (store meta so later cancellations know what was refunded)
//         item.refundAmount = refundAmount;
//         item.refundMethod = "wallet";
//         item.refundStatus = "credited";
//         item.refundDate = new Date();
//         item.refundMeta = {
//           refundBase: +refundBase.toFixed(2),
//           taxShare: +taxShare.toFixed(2),
//           shippingRefund: +shippingRefund.toFixed(2),
//           couponShare: +couponShare.toFixed(2)
//         };
//       } else {
//         // nothing refundable left — record that we attempted but nothing to credit
//         item.refundAmount = 0;
//         item.refundMethod = "none";
//         item.refundStatus = "skipped";
//         item.refundDate = new Date();
//         item.refundMeta = {
//           refundBase: +refundBase.toFixed(2),
//           taxShare: +taxShare.toFixed(2),
//           shippingRefund: +shippingRefund.toFixed(2),
//           couponShare: +couponShare.toFixed(2)
//         };
//       }
//     } // end isPrepaid && not refunded

//     // 4) Update order-level statuses carefully
//     const allCancelled = order.items.every(i => ["cancelled", "returned"].includes(i.status));
//     const anyRefunded = order.items.some(i => Number(i.refundAmount || 0) > 0);

//     if (allCancelled) {
//       order.orderStatus = "cancelled";
//       // fully refunded only if cumulative refunded equals what user paid
//       const totalRefundedSoFar = order.items.reduce((s, it) => s + Number(it.refundAmount || 0), 0);
//       if (Number(order.totalAmount || 0) > 0 && totalRefundedSoFar >= Number(order.totalAmount || 0)) {
//         order.paymentStatus = "refunded";
//       } else if (anyRefunded) {
//         order.paymentStatus = "partial_refunded";
//       }
//     } else if (anyRefunded) {
//       order.paymentStatus = "partial_refunded";
//     }

//     // save inside transaction
//     await order.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({ success: true, message: "Item cancelled successfully" });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Cancel Error:", err);
//     return res.status(500).json({ success: false, message: "Something went wrong" });
//   }
// };


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

    //  Prevent invalid return attempts
    if (item.status === "cancelled") {
      return res.json({ success: false, message: "Cancelled items cannot be returned" });
    }

    if (item.status === "returned") {
      return res.json({ success: false, message: "Item already returned" });
    }

    if (item.status === "return-requested") {
      return res.json({ success: false, message: "Return already requested" });
    }

    // Only delivered items can be returned
    if (item.status !== "delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }

    //  Mark item as return requested
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

