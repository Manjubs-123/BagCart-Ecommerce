// Add this helper function at the top of your controller file

const round2 = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔥 CENTRALIZED REFUND CALCULATION FUNCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calculateItemRefund(order, item, itemId) {
  let refundAmount = 0;

  // 🎯 OPTION 1: New orders with saved breakdown (ACCURATE)
  if (
    item.itemFinalPayable !== undefined && 
    item.itemFinalPayable !== null &&
    item.itemFinalPayable > 0
  ) {
    refundAmount = round2(Number(item.itemFinalPayable));
    
    console.log("✅ Using saved breakdown for refund:", {
      itemSubtotal: item.itemSubtotal,
      couponShare: item.itemCouponShare,
      afterCoupon: item.itemAfterCoupon,
      taxShare: item.itemTaxShare,
      shippingShare: item.itemShippingShare,
      finalPayable: item.itemFinalPayable
    });
  } 
  // 🎯 OPTION 2: Old orders without breakdown (FALLBACK)
  else {
    console.log("⚠️ No breakdown found, using fallback calculation");
    refundAmount = calculateRefundOldWay(order, item, itemId);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ SAFETY CAPS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 1. Cannot exceed total order amount
  refundAmount = Math.min(refundAmount, round2(Number(order.totalAmount || 0)));

  // 2. Cannot exceed remaining refundable amount
  const previousRefunds = round2(
    order.items.reduce((sum, i) => sum + Number(i.refundAmount || 0), 0)
  );
  
  const refundableRemaining = round2(
    Number(order.totalAmount || 0) - previousRefunds
  );

  refundAmount = Math.min(refundAmount, refundableRemaining);

  // 3. Cannot be negative
  refundAmount = Math.max(0, round2(refundAmount));

  console.log("💰 Final refund calculation:", {
    orderTotal: order.totalAmount,
    previousRefunds,
    refundableRemaining,
    calculatedRefund: refundAmount
  });

  return refundAmount;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIXED CANCEL ITEM FUNCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
      return res.json({ 
        success: false, 
        message: `Cannot cancel item with status: ${item.status}` 
      });
    }

    // Check if already refunded
    if (item.refundAmount && item.refundAmount > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ 
        success: false, 
        message: "Item already refunded" 
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: RESTORE STOCK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const product = await Product.findById(item.product).session(session);
    if (product?.variants?.[item.variantIndex]) {
      product.variants[item.variantIndex].stock = round2(
        Number(product.variants[item.variantIndex].stock || 0) + 
        Number(item.quantity || 0)
      );
      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: MARK AS CANCELLED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    item.status = "cancelled";
    item.cancelReason = reason || "Cancelled by user";
    item.cancelDetails = details || "";
    item.cancelledDate = new Date();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: CHECK IF PREPAID
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const isPrepaid =
      order.paymentMethod === "wallet" ||
      (order.paymentMethod === "razorpay" &&
        ["paid", "partial_refunded"].includes(order.paymentStatus));

    let refundAmount = 0;

    if (isPrepaid) {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ✅ STEP 4: CALCULATE REFUND
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      refundAmount = calculateItemRefund(order, item, itemId);

      // Skip if refund is 0 or negative
      if (refundAmount <= 0) {
        console.warn("⚠️ Refund amount is 0 or negative, skipping wallet credit");
      } else {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STEP 5: CREDIT TO WALLET
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let wallet = await Wallet.findOne({ user: userId }).session(session);
        if (!wallet) {
          wallet = (await Wallet.create([{
            user: userId,
            balance: 0,
            transactions: []
          }], { session }))[0];
        }

        wallet.balance = round2(Number(wallet.balance || 0) + refundAmount);
        wallet.transactions.push({
          type: "credit",
          amount: refundAmount,
          description: `Refund for cancelled item ${item.itemOrderId || itemId}`,
          date: new Date(),
          meta: {
            orderId: order.orderId,
            itemSubtotal: item.itemSubtotal,
            couponShare: item.itemCouponShare,
            itemAfterCoupon: item.itemAfterCoupon,
            taxShare: item.itemTaxShare,
            shippingShare: item.itemShippingShare,
            refundAmount: refundAmount
          }
        });

        await wallet.save({ session });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STEP 6: SAVE REFUND INFO
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        item.refundAmount = refundAmount;
        item.refundMethod = "wallet";
        item.refundStatus = "credited";
        item.refundDate = new Date();
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: UPDATE ORDER STATUS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allCancelled = order.items.every(i =>
      ["cancelled", "returned"].includes(i.status)
    );

    if (allCancelled) {
      order.orderStatus = "cancelled";
      order.paymentStatus = "refunded";
    } else {
      const anyRefunded = order.items.some(i => 
        i.refundAmount && i.refundAmount > 0
      );
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
    console.error("❌ Cancel Error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message
    });
  }
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIXED APPROVE RETURN FUNCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const approveReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, itemId } = req.params;

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
        message: `Item status is '${item.status}', not 'return-requested'`
      });
    }

    // Check if already refunded
    if (item.refundAmount && item.refundAmount > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ 
        success: false, 
        message: "Item already refunded" 
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: RESTORE STOCK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const product = await Product.findById(item.product).session(session);
    if (product && product.variants[item.variantIndex]) {
      product.variants[item.variantIndex].stock = round2(
        Number(product.variants[item.variantIndex].stock || 0) + 
        Number(item.quantity || 0)
      );
      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ STEP 2: CALCULATE REFUND
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const refundAmount = calculateItemRefund(order, item, itemId);

    if (refundAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Refund amount is 0 or invalid"
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: CREDIT TO WALLET
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

    wallet.balance = round2(Number(wallet.balance || 0) + refundAmount);
    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      description: `Return refund for item ${item.itemOrderId || itemId}`,
      date: new Date(),
      meta: {
        orderId: order.orderId,
        itemSubtotal: item.itemSubtotal,
        couponShare: item.itemCouponShare,
        itemAfterCoupon: item.itemAfterCoupon,
        taxShare: item.itemTaxShare,
        shippingShare: item.itemShippingShare,
        refundAmount: refundAmount
      }
    });

    await wallet.save({ session });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: MARK AS RETURNED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    item.status = "returned";
    item.returnApprovedDate = new Date();
    item.refundAmount = refundAmount;
    item.refundMethod = "wallet";
    item.refundStatus = "credited";
    item.refundDate = new Date();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: UPDATE ORDER STATUS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allReturned = order.items.every(i =>
      ["cancelled", "returned"].includes(i.status)
    );

    if (allReturned) {
      order.orderStatus = "cancelled";
      order.paymentStatus = "refunded";
    } else {
      const anyRefunded = order.items.some(i => 
        i.refundAmount && i.refundAmount > 0
      );
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
    console.error("❌ Approve Return Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while approving return",
      error: err.message
    });
  }
};


export function distributeOrderCostsToItems(
  items,
  subtotalBeforeCoupon,
  couponDiscount,
  totalTax,
  shippingFee
) {
  const numItems = items.length;

  /* 1️⃣ Split coupon proportionally */
  let remainingCoupon = round2(couponDiscount);

  for (let i = 0; i < numItems; i++) {
    const item = items[i];

    if (i === numItems - 1) {
      // Last item gets whatever is left (handles rounding)
      item.itemCouponShare = round2(remainingCoupon);
    } else {
      const ratio =
        subtotalBeforeCoupon > 0
          ? item.itemSubtotal / subtotalBeforeCoupon
          : 0;

      item.itemCouponShare = round2(couponDiscount * ratio);
      remainingCoupon = round2(remainingCoupon - item.itemCouponShare);
    }

    item.itemAfterCoupon = round2(item.itemSubtotal - item.itemCouponShare);
  }

  /* 2️⃣ Split tax proportionally */
  const subtotalAfterCoupon = round2(
    items.reduce((sum, i) => sum + i.itemAfterCoupon, 0)
  );

  let remainingTax = round2(totalTax);

  for (let i = 0; i < numItems; i++) {
    const item = items[i];

    if (i === numItems - 1) {
      item.itemTaxShare = round2(remainingTax);
    } else {
      const ratio =
        subtotalAfterCoupon > 0
          ? item.itemAfterCoupon / subtotalAfterCoupon
          : 0;

      item.itemTaxShare = round2(totalTax * ratio);
      remainingTax = round2(remainingTax - item.itemTaxShare);
    }
  }

  /* 3️⃣ Shipping → only last item */
  items.forEach((item, index) => {
    item.itemShippingShare = index === numItems - 1 ? round2(shippingFee) : 0;
  });

  /* 4️⃣ Final payable per item */
  items.forEach(item => {
    item.itemFinalPayable = round2(
      item.itemAfterCoupon +
      item.itemTaxShare +
      item.itemShippingShare
    );
  });

  /* 5️⃣ ✅ FINAL SAFETY CORRECTION (1 paisa fix) */
  const itemsTotal = round2(
    items.reduce((sum, i) => sum + i.itemFinalPayable, 0)
  );

  const orderTotal = round2(
    subtotalBeforeCoupon - couponDiscount + totalTax + shippingFee
  );

  const diff = round2(orderTotal - itemsTotal);

  // Only adjust if difference is exactly 0.01 or -0.01
  if (Math.abs(diff) === 0.01) {
    items[numItems - 1].itemFinalPayable = round2(
      items[numItems - 1].itemFinalPayable + diff
    );
  }

  // ✅ FINAL VALIDATION - Items must sum to order total
  const finalSum = round2(
    items.reduce((sum, i) => sum + i.itemFinalPayable, 0)
  );

  if (Math.abs(finalSum - orderTotal) > 0.01) {
    console.error("❌ CRITICAL: Item distribution failed!", {
      orderTotal,
      itemsSum: finalSum,
      difference: round2(orderTotal - finalSum)
    });
    throw new Error("Order calculation mismatch - please retry");
  }
}


/* ─────────────────────────────────────────────
   OLD ORDER REFUND CALCULATION (FALLBACK)
   ───────────────────────────────────────────── */
export function calculateRefundOldWay(order, item, itemId) {
  const itemTotal = round2(
    Number(item.price || 0) * Number(item.quantity || 1)
  );

  /* Coupon share */
  let couponShare = 0;
  if (order.coupon?.discountAmount > 0) {
    const baseSubtotal = Number(
      order.coupon.subtotalBeforeCoupon || order.subtotal || 0
    );

    if (baseSubtotal > 0) {
      couponShare = round2(
        (itemTotal / baseSubtotal) * order.coupon.discountAmount
      );
    }
  }

  const afterCoupon = round2(Math.max(0, itemTotal - couponShare));

  /* Tax share */
  let taxShare = 0;
  const totalAfterCoupon = round2(
    Number(order.subtotal || 0) - Number(order.coupon?.discountAmount || 0)
  );

  if (totalAfterCoupon > 0 && order.tax > 0) {
    taxShare = round2(
      (afterCoupon / totalAfterCoupon) * Number(order.tax || 0)
    );
  }

  /* Shipping share */
  let shippingShare = 0;
  const otherItems = order.items.filter(
    i => i._id.toString() !== itemId
  );

  const allOthersDone = otherItems.every(i =>
    ["cancelled", "returned"].includes(i.status)
  );

  if (order.items.length === 1 || allOthersDone) {
    shippingShare = round2(Number(order.shippingFee || 0));
  }

  return round2(afterCoupon + taxShare + shippingShare);
}