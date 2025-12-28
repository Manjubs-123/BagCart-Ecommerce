// Add this helper function at the top of your controller file

const round2 = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};



export function distributeOrderCostsToItems(
  items,
  subtotalBeforeCoupon,
  couponDiscount,
  totalTax,
  shippingFee
) {
  const numItems = items.length;

  /* 1️ Split coupon proportionally */
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

  /* 2️Split tax proportionally */
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

  /* 3️ Shipping → only last item */
  items.forEach((item, index) => {
    item.itemShippingShare = index === numItems - 1 ? round2(shippingFee) : 0;
  });

  /* 4️ Final payable per item */
  items.forEach(item => {
    item.itemFinalPayable = round2(
      item.itemAfterCoupon +
      item.itemTaxShare +
      item.itemShippingShare
    );
  });

  /* 5️ FINAL SAFETY CORRECTION (1 paisa fix) */
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

  //  FINAL VALIDATION - Items must sum to order total
  const finalSum = round2(
    items.reduce((sum, i) => sum + i.itemFinalPayable, 0)
  );

  if (Math.abs(finalSum - orderTotal) > 0.01) {
    console.error(" CRITICAL: Item distribution failed!", {
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