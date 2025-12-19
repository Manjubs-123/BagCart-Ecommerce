// utils/orderPricingUtils.js

/* ─────────────────────────────────────────────
   COMMON ROUNDING HELPER
   ───────────────────────────────────────────── */
const round2 = (n) =>
  Number((n + Number.EPSILON).toFixed(2));


/* ─────────────────────────────────────────────
   DISTRIBUTE ORDER COSTS (NEW ORDERS) 
   ───────────────────────────────────────────── */
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
      item.itemCouponShare = round2(remainingCoupon);
    } else {
      const ratio =
        subtotalBeforeCoupon > 0
          ? item.itemSubtotal / subtotalBeforeCoupon
          : 0;

      item.itemCouponShare = round2(couponDiscount * ratio);
      remainingCoupon = round2(
        remainingCoupon - item.itemCouponShare
      );
    }

    item.itemAfterCoupon = round2(
      item.itemSubtotal - item.itemCouponShare
    );
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
      remainingTax = round2(
        remainingTax - item.itemTaxShare
      );
    }
  }

  /* 3️⃣ Shipping → only last item */
  items.forEach((item, index) => {
    item.itemShippingShare =
      index === numItems - 1 ? round2(shippingFee) : 0;
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

  if (Math.abs(diff) === 0.01) {
    // Adjust last item safely
    items[numItems - 1].itemFinalPayable = round2(
      items[numItems - 1].itemFinalPayable + diff
    );
  }
}


/* ─────────────────────────────────────────────
   OLD ORDER REFUND CALCULATION (FALLBACK)
   ───────────────────────────────────────────── */
export function calculateRefundOldWay(order, item, itemId) {
  const itemTotal =
    Number(item.price) * Number(item.quantity);

  /* Coupon share */
  let couponShare = 0;
  if (order.coupon?.discountAmount > 0) {
    const baseSubtotal =
      order.coupon.subtotalBeforeCoupon || order.subtotal;

    if (baseSubtotal > 0) {
      couponShare =
        (itemTotal / baseSubtotal) *
        order.coupon.discountAmount;
    }
  }

  const afterCoupon = Math.max(
    0,
    round2(itemTotal - couponShare)
  );

  /* Tax share */
  let taxShare = 0;
  const totalAfterCoupon =
    order.subtotal - (order.coupon?.discountAmount || 0);

  if (totalAfterCoupon > 0 && order.tax > 0) {
    taxShare =
      (afterCoupon / totalAfterCoupon) * order.tax;
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
    shippingShare = order.shippingFee;
  }

  return round2(afterCoupon + taxShare + shippingShare);
}
