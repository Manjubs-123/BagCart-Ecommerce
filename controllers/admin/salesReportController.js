import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

/* -------------------------------------------------------
   HELPER: Calculate offer discount for an item
------------------------------------------------------- */
const calculateItemOfferDiscount = (item, product) => {
  try {
    const qty = Number(item.quantity) || 0;
    if (qty === 0) return 0;

    // If product/variant exists we can try to recover original list price
    const variant = product?.variants?.[item.variantIndex];

    // original (list) price - prefer variant.price, fallback to item.price
    const originalPrice = Number(variant?.price ?? item.originalPrice ?? item.price ?? 0);

    // price paid for the line item (snapshot). This is the most reliable source.
    // item.price should represent the price charged per unit when order was placed.
    const paidPrice = Number(item.price ?? variant?.offerPrice ?? originalPrice);

    // discount per unit cannot be negative
    const discountPerUnit = Math.max(0, originalPrice - paidPrice);

    return discountPerUnit * qty;
  } catch (e) {
    // fail safe
    return 0;
  }
};
/* -------------------------------------------------------
   FETCH SALES REPORT DATA - FIXED WITH PROPER DISCOUNTS
------------------------------------------------------- */

export const getSalesReport = async (req, res) => {
  try {
    let { fromDate, toDate, page = 1, limit = 10 } = req.body;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    // Date filter
    const filter = {};
    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate + "T23:59:59"),
      };
    }

    // Fetch orders with proper population
    const orders = await Order.find(filter)
      .populate("user")
      .populate({
        path: "items.product",
        populate: { path: "category" }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

      // ---------- DEBUG: inspect coupon-like fields (safe) ----------
// try {
//   console.log("SALES REPORT DEBUG: orders fetched:", orders.length);
//   orders.slice(0, 3).forEach((o, idx) => {
//     console.log(`SALES REPORT DEBUG (#${idx+1}) orderId=${o.orderId || o._id}`);
//     console.log("  coupon:", o.coupon);
//     console.log("  couponDiscount:", o.couponDiscount, " discountApplied:", o.discountApplied, " discountAmount:", o.discountAmount);
//     console.log("  keys:", Object.keys(o).slice(0, 40));
//   });
// } catch (err) {
//   console.log("SALES REPORT DEBUG error:", err);
// }

// ---------- HELPER: get coupon discount from ANY field ----------
function getCouponDiscountAndLog(order) {
  const fields = [
    { key: "coupon.discountAmount", value: order?.coupon?.discountAmount },
    { key: "coupon.discount", value: order?.coupon?.discount },
    { key: "couponDiscount", value: order?.couponDiscount },
    { key: "discountApplied", value: order?.discountApplied },
    { key: "discountAmount", value: order?.discountAmount },
    { key: "discount", value: order?.discount },
  ];

  for (const f of fields) {
    if (f.value !== undefined && f.value !== null && !isNaN(f.value)) {
      console.log(`SALES REPORT: coupon from "${f.key}" = ${f.value} for order=${order.orderId}`);
      return Number(f.value);
    }
  }

  return 0;
}


    const totalOrders = await Order.countDocuments(filter);

    /* -------------------------------------------------------
       SUMMARY CALCULATIONS WITH ALL DISCOUNTS
    ------------------------------------------------------- */
    let totalRevenue = 0;
    let totalCouponDiscount = 0;
    let totalOfferDiscount = 0;

   // When computing totals for each fetched order
orders.forEach((order) => {
  totalRevenue += Number(order.totalAmount) || 0;

  // Coupon discount (make sure numeric)
totalCouponDiscount += Number(
    order.coupon?.discountAmount ??
    order.coupon?.discount ??
    order.discountApplied ??
    order.couponDiscount ??
    order.discountAmount ??
    0
);


  // Offer discount: prefer stored order.offerDiscount (if valid number > 0).
  // Otherwise calculate from items using the robust helper.
  let orderOfferDiscount = Number(order.offerDiscount) || 0;

  if (!orderOfferDiscount || orderOfferDiscount === 0) {
    // Calculate from items using snapshot prices
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        orderOfferDiscount += calculateItemOfferDiscount(item, item.product);
      }
    }
  }

  totalOfferDiscount += orderOfferDiscount;
});


    const totalDiscount = totalCouponDiscount + totalOfferDiscount;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    /* -------------------------------------------------------
       FORMAT SALES TABLE WITH ALL DISCOUNT DETAILS
    ------------------------------------------------------- */
   const sales = orders.map((order) => {
const couponDiscount = Number(
    order.coupon?.discountAmount ??
    order.coupon?.discount ??
    order.discountApplied ??
    order.couponDiscount ??
    order.discountAmount ??
    0
);


  let offerDiscount = Number(order.offerDiscount) || 0;
  if (!offerDiscount || offerDiscount === 0) {
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        offerDiscount += calculateItemOfferDiscount(item, item.product);
      }
    }
  }

  // itemDetails: compute originalPrice from variant.price when possible,
  // and use item.price as the paid / effective price for totals.
  const itemDetails = order.items.map(item => {
    const product = item.product || {};
    const variant = product?.variants?.[item.variantIndex];
    const originalPrice = Number(variant?.price ?? item.originalPrice ?? item.price ?? 0);
    const offerPrice = Number(item.price ?? variant?.offerPrice ?? originalPrice);
    const itemOfferDiscount = Math.max(0, originalPrice - offerPrice) * (Number(item.quantity) || 0);

    return {
      productName: product?.name || "Unknown Product",
      category: product?.category?.name || "Uncategorized",
      quantity: Number(item.quantity) || 0,
      originalPrice,
      offerPrice,
      itemOfferDiscount,
      total: (Number(item.quantity) || 0) * offerPrice
    };
  });

  const subtotalBeforeDiscounts = itemDetails.reduce((sum, it) => sum + (it.originalPrice * it.quantity), 0);

  return {
    date: order.createdAt,
    orderId: order.orderId,
    itemOrderId: order.items[0]?.itemOrderId || "N/A",
    items: order.items.length,
    itemDetails,
    subtotalBeforeDiscounts,
    subtotal: Number(order.subtotal) || 0,
    couponDiscount,
    offerDiscount,
    totalDiscount: couponDiscount + offerDiscount,
    total: Number(order.totalAmount) || 0,
    paymentMethod: order.paymentMethod,
    status: order.orderStatus,
    customer: {
      name: order.user?.name || "Unknown",
      email: order.user?.email || "",
    },
  };
});


    /* -------------------------------------------------------
       REVENUE CHART DATA
    ------------------------------------------------------- */
    const revenueAgg = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const chartLabels = revenueAgg.map((i) => i._id);
    const chartValues = revenueAgg.map((i) => i.total);

    /* -------------------------------------------------------
       CATEGORY CHART - SHOWS CATEGORY NAMES
    ------------------------------------------------------- */
    const categoryAgg = await Order.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails.name",
          count: { $sum: 1 },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
        },
      },
      { $sort: { revenue: -1 } }
    ]);

    const categoryLabels = categoryAgg.map((c) => c._id);
    const categoryValues = categoryAgg.map((c) => c.count);

    /* -------------------------------------------------------
       PAYMENT METHODS SUMMARY
    ------------------------------------------------------- */
    const paymentAgg = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          amount: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const paymentMethods = paymentAgg.map((p) => ({
      name: p._id,
      amount: p.amount,
      count: p.count,
    }));

    /* -------------------------------------------------------
       TOP PRODUCTS WITH CATEGORY NAMES
    ------------------------------------------------------- */
    const topProductsAgg = await Order.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          quantity: { $sum: "$items.quantity" },
          revenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topProducts = [];
    for (let p of topProductsAgg) {
      const product = await Product.findById(p._id).populate("category");
      if (product) {
        topProducts.push({
          name: product.name,
          category: product.category?.name || "Uncategorized",
          quantity: p.quantity,
          revenue: p.revenue,
        });
      }
    }

    /* -------------------------------------------------------
       COUPON PERFORMANCE
    ------------------------------------------------------- */
    const couponAgg = await Order.aggregate([
      { $match: filter },
      { $match: { "coupon.code": { $ne: null, $exists: true } } },
      {
        $group: {
          _id: "$coupon.code",
          uses: { $sum: 1 },
          savings: { $sum: "$coupon.discountAmount" },
          discountPercent: { $first: "$coupon.discountValue" }
        },
      },
    ]);

    const couponPerformance = couponAgg.map((c) => ({
      code: c._id,
      uses: c.uses,
      savings: c.savings || 0,
      discount: c.discountPercent || 0,
    }));

    /* -------------------------------------------------------
       PAGINATION
    ------------------------------------------------------- */
    const pagination = {
      page,
      limit,
      total: totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      start: skip + 1,
      end: skip + sales.length,
    };

    return res.json({
      success: true,
      summary: {
        totalOrders,
        totalRevenue,
        totalCouponDiscount,
        totalOfferDiscount,
        totalDiscount,
        avgOrderValue,
      },
      sales,
      charts: {
        revenue: { labels: chartLabels, data: chartValues },
        categories: { labels: categoryLabels, data: categoryValues },
      },
      pagination,
      topProducts,
      paymentMethods,
      couponPerformance,
    });
  } catch (error) {
    console.error("SALES REPORT ERROR:", error);
    return res.json({
      success: false,
      message: "Failed to load sales report",
    });
  }
};

/* -------------------------------------------------------
   DOWNLOAD SALES REPORT - WITH PROPER DISCOUNTS
------------------------------------------------------- */
export const downloadSalesReport = async (req, res) => {
  try {
    const { fromDate, toDate, format } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ 
        success: false, 
        message: "fromDate and toDate required" 
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Fetch all orders in date range with proper population
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    })
      .populate("user")
      .populate({
        path: "items.product",
        populate: { path: "category" }
      })
      .sort({ createdAt: -1 });

    // Prepare detailed rows with all discount information
    const rows = orders.map((o) => {
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "";
      const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
      const subtotal = typeof o.subtotal === "number" ? o.subtotal : 0;
      const couponDiscount = o.coupon?.discountAmount || 0;
      
      // Calculate offer discount
      let offerDiscount = o.offerDiscount || 0;
      if (offerDiscount === 0 && o.items && o.items.length > 0) {
        o.items.forEach((item) => {
          offerDiscount += calculateItemOfferDiscount(item, item.product);
        });
      }
      
      const totalDiscount = couponDiscount + offerDiscount;
      const total = typeof o.totalAmount === "number" ? o.totalAmount : 0;
      const paymentMethod = o.paymentMethod || "";
      const status = o.orderStatus || "";
      const customer = o.user ? o.user.name || "Unknown" : "Unknown";

      // Get product categories for the order
      const categories = o.items
        .map(item => item.product?.category?.name || "Uncategorized")
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ");

      const itemOrderId = o.items[0]?.itemOrderId || "";

      return {
        orderId: o.orderId || "",
        itemOrderId: itemOrderId,
        date: dateStr,
        customer,
        items: itemsCount,
        categories: categories,
        subtotal,
        couponDiscount,
        offerDiscount,
        totalDiscount,
        total,
        paymentMethod,
        status,
      };
    });

    const filenameBase = `sales-report-${fromDate}-to-${toDate}`;

    /* -------------------------------------------------------
       CSV DOWNLOAD - WITH ALL DISCOUNT COLUMNS
    ------------------------------------------------------- */
    if (format === "csv") {
      const header = [
        "Order ID",
        "Item Order ID",
        "Date",
        "Customer",
        "Items",
        "Categories",
        "Subtotal",
        "Coupon Discount",
        "Offer Discount",
        "Total Discount",
        "Final Amount",
        "Payment Method",
        "Status",
      ];

      const csvLines = [header.join(",")];

      rows.forEach((r) => {
        const values = [
          r.orderId,
          r.itemOrderId,
          r.date,
          `"${r.customer}"`,
          r.items,
          `"${r.categories}"`,
          r.subtotal,
          r.couponDiscount,
          r.offerDiscount,
          r.totalDiscount,
          r.total,
          r.paymentMethod,
          r.status,
        ];
        csvLines.push(values.join(","));
      });

      const csv = csvLines.join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}.csv"`
      );
      return res.send(csv);
    }

    /* -------------------------------------------------------
       EXCEL DOWNLOAD - PROPERLY FORMATTED
    ------------------------------------------------------- */
    if (format === "excel" || format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sales Report");

      // Add summary section
      sheet.addRow(["SALES REPORT SUMMARY"]);
      sheet.addRow([`Period: ${fromDate} to ${toDate}`]);
      sheet.addRow([]);

      const totalRevenue = rows.reduce((sum, r) => sum + r.total, 0);
      const totalCouponDisc = rows.reduce((sum, r) => sum + r.couponDiscount, 0);
      const totalOfferDisc = rows.reduce((sum, r) => sum + r.offerDiscount, 0);

      sheet.addRow(["Total Orders:", rows.length]);
      sheet.addRow(["Total Revenue:", `₹${totalRevenue.toFixed(2)}`]);
      sheet.addRow(["Total Coupon Discount:", `₹${totalCouponDisc.toFixed(2)}`]);
      sheet.addRow(["Total Offer Discount:", `₹${totalOfferDisc.toFixed(2)}`]);
      sheet.addRow([]);

      // Add column headers
      sheet.columns = [
        { header: "Order ID", key: "orderId", width: 15 },
        { header: "Item Order ID", key: "itemOrderId", width: 15 },
        { header: "Date", key: "date", width: 12 },
        { header: "Customer", key: "customer", width: 20 },
        { header: "Items", key: "items", width: 8 },
        { header: "Categories", key: "categories", width: 20 },
        { header: "Subtotal (₹)", key: "subtotal", width: 12 },
        { header: "Coupon Disc (₹)", key: "couponDiscount", width: 12 },
        { header: "Offer Disc (₹)", key: "offerDiscount", width: 12 },
        { header: "Total Disc (₹)", key: "totalDiscount", width: 12 },
        { header: "Final Amount (₹)", key: "total", width: 14 },
        { header: "Payment", key: "paymentMethod", width: 12 },
        { header: "Status", key: "status", width: 12 },
      ];

      // Style header row
      const headerRow = sheet.getRow(sheet.rowCount);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11, color: { argb: "FFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "366092" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Add data rows
      rows.forEach((r) => {
        const row = sheet.addRow({
          orderId: r.orderId,
          itemOrderId: r.itemOrderId,
          date: r.date,
          customer: r.customer,
          items: r.items,
          categories: r.categories,
          subtotal: r.subtotal,
          couponDiscount: r.couponDiscount,
          offerDiscount: r.offerDiscount,
          totalDiscount: r.totalDiscount,
          total: r.total,
          paymentMethod: r.paymentMethod,
          status: r.status,
        });

        // Style data cells
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          // Format number columns
          if (colNumber >= 7 && colNumber <= 11) {
            cell.numFmt = "#,##0.00";
            cell.alignment = { horizontal: "right" };
          }
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}.xlsx"`
      );

      await workbook.xlsx.write(res);
      return;
    }

    /* -------------------------------------------------------
       PDF DOWNLOAD - PROPERLY ALIGNED
    ------------------------------------------------------- */
   /* -------------------------------------------------------
   PDF DOWNLOAD - PROPERLY ALIGNED WITH UNICODE SUPPORT
------------------------------------------------------- */
if (format === "pdf") {
  const doc = new PDFDocument({ 
    margin: 30, 
    size: "A4",
    layout: "landscape"
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filenameBase}.pdf"`
  );

  doc.pipe(res);

  // Register Unicode font (use a font file available on your server)
  // Option 1: If you have the font file locally
  // doc.registerFont('Regular', path.join(__dirname, '../fonts/NotoSans-Regular.ttf'));
  // doc.registerFont('Bold', path.join(__dirname, '../fonts/NotoSans-Bold.ttf'));
  
  // Option 2: For development/testing - use built-in Courier (limited Unicode)
  // For production, download NotoSans or Roboto fonts and use Option 1
  
  // Using Helvetica as base but we'll handle ₹ specially
  const useUnicodeFont = false; // Set to true when you have font files

  // Helper function to draw text with proper rupee symbol
  const drawText = (text, x, y, options = {}) => {
    const textStr = String(text);
    if (textStr.includes('₹')) {
      // Replace ₹ with Rs. for now (or use Unicode font when available)
      const replaced = textStr.replace(/₹/g, 'Rs.');
      doc.text(replaced, x, y, options);
    } else {
      doc.text(textStr, x, y, options);
    }
  };

  // Title
  doc.fontSize(18).font(useUnicodeFont ? 'Bold' : 'Helvetica-Bold')
     .text("Sales Report", { align: "center" });
  doc.fontSize(10).font(useUnicodeFont ? 'Regular' : 'Helvetica')
     .text(`Period: ${fromDate} → ${toDate}`, { align: "center" });
  doc.moveDown(1);

  // Summary section
  const totalRevenue = rows.reduce((sum, r) => sum + r.total, 0);
  const totalCouponDisc = rows.reduce((sum, r) => sum + r.couponDiscount, 0);
  const totalOfferDisc = rows.reduce((sum, r) => sum + r.offerDiscount, 0);

  doc.fontSize(10).font(useUnicodeFont ? 'Bold' : 'Helvetica-Bold');
  drawText(`Total Orders: ${rows.length}`, 40, doc.y);
  doc.moveDown(0.3);
  drawText(`Total Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 40, doc.y);
  doc.moveDown(0.3);
  drawText(`Total Coupon Discount: ₹${totalCouponDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 40, doc.y);
  doc.moveDown(0.3);
  drawText(`Total Offer Discount: ₹${totalOfferDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 40, doc.y);
  doc.moveDown(1.5);

  // Table configuration with adjusted widths
  const colWidths = {
    orderId: 65,
    date: 55,
    customer: 75,
    items: 30,
    categories: 85,
    subtotal: 55,
    couponDisc: 50,
    offerDisc: 50,
    totalDisc: 50,
    total: 55,
    payment: 65,
    status: 50,
  };

  const headers = [
    "Order ID",
    "Date",
    "Customer",
    "Items",
    "Categories",
    "Subtotal",
    "Coupon",
    "Offer",
    "Total Disc",
    "Final",
    "Payment",
    "Status",
  ];

  const startX = 30;
  const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

  // Function to draw table header
  const drawTableHeader = () => {
    const headerY = doc.y;
    
    // Draw header background
    doc.rect(startX, headerY - 3, tableWidth, 18)
       .fill('#366092');
    
    // Draw header text
    doc.font(useUnicodeFont ? 'Bold' : 'Helvetica-Bold')
       .fontSize(8)
       .fillColor('white');
    
    let x = startX;
    Object.keys(colWidths).forEach((key, i) => {
      const width = colWidths[key];
      doc.text(headers[i], x + 2, headerY, { 
        width: width - 4, 
        align: 'center',
        lineBreak: false
      });
      x += width;
    });
    
    doc.fillColor('black');
    doc.moveDown(1.2);
  };

  // Draw initial header
  drawTableHeader();

  // Data rows
  doc.font(useUnicodeFont ? 'Regular' : 'Helvetica').fontSize(7);

  rows.forEach((r, rowIndex) => {
    // Prepare row data with proper formatting
    const rowData = [
      r.orderId || '',
      r.date || '',
      r.customer.substring(0, 18) || '',
      String(r.items) || '0',
      r.categories.substring(0, 22) || '',
      r.subtotal.toFixed(2),
      r.couponDiscount.toFixed(2),
      r.offerDiscount.toFixed(2),
      r.totalDiscount.toFixed(2),
      r.total.toFixed(2),
      r.paymentMethod || '',
      r.status || '',
    ];

    // Calculate row height needed (check all columns)
    let maxHeight = 12; // Minimum row height
    Object.keys(colWidths).forEach((key, i) => {
      const width = colWidths[key];
      const value = String(rowData[i]);
      const height = doc.heightOfString(value, { 
        width: width - 4,
        lineBreak: true
      });
      if (height > maxHeight) maxHeight = height;
    });

    // Check if we need a new page (leave 50px margin at bottom)
    if (doc.y + maxHeight + 10 > doc.page.height - 50) {
      doc.addPage({ layout: 'landscape' });
      doc.y = 40;
      drawTableHeader();
    }

    const rowY = doc.y;
    
    // Draw alternating row background for readability
    if (rowIndex % 2 === 0) {
      doc.rect(startX, rowY - 2, tableWidth, maxHeight + 4)
         .fill('#f8f9fa')
         .fillColor('black');
    }

    // Draw cell borders and content
    let x = startX;
    Object.keys(colWidths).forEach((key, i) => {
      const width = colWidths[key];
      const value = rowData[i];
      
      // Determine alignment (right-align numeric columns)
      const isNumeric = i >= 5 && i <= 9;
      const align = isNumeric ? 'right' : 'left';
      
      // Add padding
const padding = 3;

// Draw text with rupee symbol handling
const displayValue = (i >= 5 && i <= 9) ? `₹${value}` : value;

drawText(displayValue, x + padding, rowY, {
  width: width - (padding * 2),
  align: align,        // left or right
  lineBreak: true
});

      
      // Draw vertical border (light gray)
      if (i < Object.keys(colWidths).length - 1) {
        doc.strokeColor('#e0e0e0')
           .moveTo(x + width, rowY - 2)
           .lineTo(x + width, rowY + maxHeight + 2)
           .stroke()
           .strokeColor('black');
      }
      
      x += width;
    });

    // Draw horizontal border at bottom of row
    doc.strokeColor('#e0e0e0')
       .moveTo(startX, rowY + maxHeight + 2)
       .lineTo(startX + tableWidth, rowY + maxHeight + 2)
       .stroke()
       .strokeColor('black');

    // Move to next row
    doc.y = rowY + maxHeight + 4;
  });

  // Add footer with page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8)
       .font(useUnicodeFont ? 'Regular' : 'Helvetica')
       .text(
         `Page ${i + 1} of ${pages.count}`,
         0,
         doc.page.height - 30,
         { align: 'center' }
       );
  }

  doc.end();
  return;
}
    return res.status(400).json({ 
      success: false, 
      message: "Unsupported format. Use 'csv', 'excel', or 'pdf'" 
    });

  } catch (err) {
    console.error("DOWNLOAD REPORT ERROR:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to download report" 
    });
  }
};