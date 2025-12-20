/**
 * Calculates dynamic order summary based on item statuses
 * Handles partial cancellations and returns
 * 
 * @param {Object} order - The order document
 * @returns {Object} Summary with calculated totals
 */
export function buildOrderSummary(order) {
  const round2 = (num) => Math.round(num * 100) / 100;

  // Define active and inactive statuses
  const activeStatuses = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
  const cancelledStatuses = ['cancelled'];
  const returnedStatuses = ['returned', 'return-approved'];

  // Initialize accumulators
  let activeItemsSubtotal = 0;
  let activeItemsTax = 0;
  let activeItemsShipping = 0;
  let activeItemsCount = 0;

  let cancelledTotal = 0;
  let returnedTotal = 0;

  // Process each item
  order.items.forEach(item => {
    const status = item.status || 'pending';

    if (activeStatuses.includes(status)) {
      // Active items contribute to grand total
      if (item.itemFinalPayable !== undefined && item.itemFinalPayable > 0) {
        // NEW ORDERS: Use saved breakdown
        activeItemsSubtotal += item.itemAfterCoupon || 0;
        activeItemsTax += item.itemTaxShare || 0;
        activeItemsShipping += item.itemShippingShare || 0;
      } else {
        // OLD ORDERS: Fallback calculation
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        activeItemsSubtotal += itemTotal;
      }
      activeItemsCount++;
    } 
    else if (cancelledStatuses.includes(status)) {
      // Cancelled items
      cancelledTotal += item.refundAmount || 0;
    } 
    else if (returnedStatuses.includes(status)) {
      // Returned items
      returnedTotal += item.refundAmount || 0;
    }
  });

  // Calculate grand total from active items only
  let grandTotal = 0;
  
  if (activeItemsCount > 0) {
    // Check if ANY active item has breakdown saved
    const hasBreakdown = order.items.some(item => 
      activeStatuses.includes(item.status || 'pending') && 
      item.itemFinalPayable !== undefined && 
      item.itemFinalPayable > 0
    );

    if (hasBreakdown) {
      // NEW ORDERS: Sum itemFinalPayable for active items
      grandTotal = order.items
        .filter(item => activeStatuses.includes(item.status || 'pending'))
        .reduce((sum, item) => sum + (item.itemFinalPayable || 0), 0);
    } else {
      // OLD ORDERS: Use proportional calculation
      const totalItems = order.items.length;
      const activeRatio = activeItemsCount / totalItems;
      
      // Apply ratio to order totals
      const proportionalSubtotal = (order.subtotal || 0) * activeRatio;
      const proportionalTax = (order.tax || 0) * activeRatio;
      const proportionalShipping = (order.shippingFee || 0) * activeRatio;
      
      grandTotal = proportionalSubtotal + proportionalTax + proportionalShipping;
    }
  }

  // Round all values
  grandTotal = round2(grandTotal);
  cancelledTotal = round2(cancelledTotal);
  returnedTotal = round2(returnedTotal);
  activeItemsSubtotal = round2(activeItemsSubtotal);
  activeItemsTax = round2(activeItemsTax);
  activeItemsShipping = round2(activeItemsShipping);

  // Calculate coupon discount for active items only
  let activeCouponDiscount = 0;
  if (order.coupon && order.coupon.discountAmount > 0 && activeItemsCount > 0) {
    const totalItems = order.items.length;
    const activeRatio = activeItemsCount / totalItems;
    activeCouponDiscount = round2(order.coupon.discountAmount * activeRatio);
  }

  // Calculate original price (before discounts) for active items
  let activeOriginalPrice = 0;
  order.items.forEach(item => {
    const status = item.status || 'pending';
    if (activeStatuses.includes(status)) {
      const regularPrice = item.regularPrice || item.price || 0;
      activeOriginalPrice += regularPrice * (item.quantity || 1);
    }
  });
  activeOriginalPrice = round2(activeOriginalPrice);

  // Calculate total savings for active items
  const productDiscounts = round2(activeOriginalPrice - activeItemsSubtotal);
  const totalSavings = round2(productDiscounts + activeCouponDiscount);

  return {
    // Active items breakdown
    activeItemsCount,
    activeItemsSubtotal,
    activeItemsTax,
    activeItemsShipping,
    activeCouponDiscount,
    activeOriginalPrice,
    
    // Savings
    productDiscounts,
    totalSavings,
    
    // Cancelled/Returned
    cancelledTotal,
    returnedTotal,
    
    // Final total
    grandTotal,
    
    // Original order values (for reference)
    originalSubtotal: order.subtotal || 0,
    originalTax: order.tax || 0,
    originalShipping: order.shippingFee || 0,
    originalTotal: order.totalAmount || 0
  };
}