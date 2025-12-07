import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Coupon from "../../models/couponModel.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";

/* -------------------------------------------------------
   FETCH SALES REPORT DATA
------------------------------------------------------- */


// export const getSalesReport = async (req, res) => {
//     try {
//         let { fromDate, toDate, page = 1, limit = 10 } = req.body;

//         page = parseInt(page) || 1;
//         limit = parseInt(limit) || 10;

//         if (page < 1) page = 1;

//         const skip = (page - 1) * limit;

//         // FIX: Prevent negative skip
//         if (skip < 0) skip = 0;

//         // Build Date Filter
//         const filter = {};
//         if (fromDate && toDate) {
//             filter.createdAt = {
//                 $gte: new Date(fromDate),
//                 $lte: new Date(toDate + "T23:59:59")
//             };
//         }

//         // Fetch Matching Orders
//         const orders = await Order.find(filter)
//             .populate("user")
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(limit);

//         const totalOrders = await Order.countDocuments(filter);

//         // Summary Calculations
//         let totalRevenue = 0;
//         let totalDiscount = 0;

//         orders.forEach(order => {
//             totalRevenue += order.totalAmount;
//             totalDiscount += order.discountAmount || 0;
//         });

//         const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

//         // Sales Table Formatting
//         const sales = orders.map(order => ({
//             date: order.createdAt,
//             orderId: order.orderId,
//             items: order.items.length,
//             subtotal: order.subTotal,
//             discount: order.discountAmount || 0,
//             total: order.totalAmount,
//             paymentMethod: order.paymentMethod,
//             status: order.orderStatus,
//             customer: {
//                 name: order.user?.name || "Unknown",
//                 email: order.user?.email || "Unknown"
//             }
//         }));

//         // Revenue Chart Data
//         const revenueAgg = await Order.aggregate([
//             { $match: filter },
//             {
//                 $group: {
//                     _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
//                     total: { $sum: "$totalAmount" }
//                 }
//             },
//             { $sort: { "_id": 1 } }
//         ]);

//         const chartLabels = revenueAgg.map(i => i._id);
//         const chartValues = revenueAgg.map(i => i.total);

//         // Category Chart Data
//         const categoryAgg = await Order.aggregate([
//             { $match: filter },
//             { $unwind: "$items" },
//             {
//                 $lookup: {
//                     from: "products",
//                     localField: "items.productId",
//                     foreignField: "_id",
//                     as: "productDetails"
//                 }
//             },
//             { $unwind: "$productDetails" },
//             {
//                 $group: {
//                     _id: "$productDetails.category",
//                     count: { $sum: 1 }
//                 }
//             }
//         ]);

//         const categoryLabels = categoryAgg.map(c => c._id);
//         const categoryValues = categoryAgg.map(c => c.count);

//         // Payment Methods
//         const paymentAgg = await Order.aggregate([
//             { $match: filter },
//             {
//                 $group: {
//                     _id: "$paymentMethod",
//                     amount: { $sum: "$totalAmount" },
//                     count: { $sum: 1 }
//                 }
//             }
//         ]);

//         const paymentMethods = paymentAgg.map(p => ({
//             name: p._id,
//             amount: p.amount,
//             count: p.count
//         }));

//         // Top Products
//         const topProductsAgg = await Order.aggregate([
//             { $match: filter },
//             { $unwind: "$items" },
//             {
//                 $group: {
//                     _id: "$items.productId",
//                     quantity: { $sum: "$items.quantity" },
//                     revenue: { $sum: "$items.total" }
//                 }
//             },
//             { $sort: { revenue: -1 } },
//             { $limit: 5 }
//         ]);

//         const topProducts = [];
//         for (let p of topProductsAgg) {
//             const product = await Product.findById(p._id);
//             if (product) {
//                 topProducts.push({
//                     name: product.name,
//                     category: product.category,
//                     quantity: p.quantity,
//                     revenue: p.revenue
//                 });
//             }
//         }

//         // Coupon Performance
//         const couponAgg = await Order.aggregate([
//             { $match: filter },
//             { $match: { couponCode: { $ne: null } } },
//             {
//                 $group: {
//                     _id: "$couponCode",
//                     uses: { $sum: 1 },
//                     savings: { $sum: "$discountAmount" }
//                 }
//             }
//         ]);

//         const couponPerformance = couponAgg.map(c => ({
//             code: c._id,
//             uses: c.uses,
//             savings: c.savings
//         }));

//         // Pagination Info
//         const pagination = {
//             page,
//             limit,
//             total: totalOrders,
//             totalPages: Math.ceil(totalOrders / limit),
//             start: skip + 1,
//             end: skip + sales.length
//         };

//         return res.json({
//             success: true,
//             summary: {
//                 totalOrders,
//                 totalRevenue,
//                 totalDiscount,
//                 avgOrderValue,
//                 revenueChange: 0,
//                 ordersChange: 0,
//                 discountChange: 0,
//                 avgOrderChange: 0
//             },
//             sales,
//             charts: {
//                 revenue: {
//                     labels: chartLabels,
//                     data: chartValues
//                 },
//                 categories: {
//                     labels: categoryLabels,
//                     data: categoryValues
//                 }
//             },
//             pagination,
//             topProducts,
//             paymentMethods,
//             couponPerformance
//         });

//     } catch (error) {
//         console.error("SALES REPORT ERROR:", error);
//         return res.json({
//             success: false,
//             message: "Failed to load sales report"
//         });
//     }
// };


/* -------------------------------------------------------
   FETCH SALES REPORT DATA (FIXED)
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

    // Fetch orders
    const orders = await Order.find(filter)
      .populate("user")
      .populate("items.product")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(filter);

    // Summary Calculations
    // Summary Calculations
let totalRevenue = 0;
let totalDiscount = 0;

orders.forEach((order) => {
    const couponDiscount = order.coupon?.discountAmount || 0;
    const offerDiscount = order.offerDiscount || 0;

    totalRevenue += order.totalAmount || 0;
    totalDiscount += couponDiscount + offerDiscount;
});

const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // let totalRevenue = 0;
    // let totalDiscount = 0;

    // orders.forEach((order) => {
    //   totalRevenue += order.totalAmount || 0;
    //   totalDiscount += order.coupon?.discountAmount || 0;
    // });

    // const avgOrderValue = totalOrders
    //   ? totalRevenue / totalOrders
    //   : 0;

    /* -----------------------------------------
       FORMAT SALES TABLE
    ------------------------------------------ */
/* -----------------------------------------
   FORMAT SALES TABLE
----------------------------------------- */


const sales = orders.map((order) => {
  const couponDiscount = order.coupon?.discountAmount || 0;
  const offerDiscount = order.offerDiscount || 0;

  return {
    date: order.createdAt,
    orderId: order.orderId,
    itemOrderId: order.items[0]?.itemOrderId || "N/A",

    items: order.items.length,

    // FIXED — always use subtotal (NOT subTotal)
    subtotal: order.subtotal || 0,

    // FIXED — send actual discount values
    couponDiscount,
    offerDiscount,

    // total discount
    totalDiscount: couponDiscount + offerDiscount,

    total: order.totalAmount || 0,
    paymentMethod: order.paymentMethod,
    status: order.orderStatus,

    customer: {
      name: order.user?.name || "Unknown",
      email: order.user?.email || "",
    },
  };
});

    /* -----------------------------------------
       REVENUE CHART
    ------------------------------------------ */
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

    /* -----------------------------------------
       CATEGORY CHART (FIXED product reference)
    ------------------------------------------ */
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
        $group: {
          _id: "$productDetails.category",
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryLabels = categoryAgg.map((c) => c._id);
    const categoryValues = categoryAgg.map((c) => c.count);

    /* -----------------------------------------
       PAYMENT SUMMARY
    ------------------------------------------ */
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

    /* -----------------------------------------
       TOP PRODUCTS (FIXED)
    ------------------------------------------ */
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
      const product = await Product.findById(p._id);
      topProducts.push({
        name: product?.name,
        category: product?.category,
        quantity: p.quantity,
        revenue: p.revenue,
      });
    }
/* -----------------------------------------
   COUPON PERFORMANCE (FIXED)
------------------------------------------ */
const couponAgg = await Order.aggregate([
  { $match: filter },
  { $match: { "coupon.code": { $ne: null, $exists: true } } },
  {
    $group: {
      _id: "$coupon.code",
      uses: { $sum: 1 },
      savings: { $sum: "$coupon.discountAmount" }
    }
  }
]);

const couponPerformance = couponAgg.map((c) => ({
  code: c._id,
  uses: c.uses,
  savings: c.savings || 0,
}));
    /* -----------------------------------------
       PAGINATION
    ------------------------------------------ */
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
   DOWNLOAD SALES REPORT
------------------------------------------------------- */
// export const downloadSalesReport = async (req, res) => {
//   try {
//     const { fromDate, toDate, format } = req.body;

//     const start = new Date(fromDate);
//     const end = new Date(toDate);
//     end.setHours(23, 59, 59, 999);

//     const orders = await Order.find({
//       paymentStatus: "paid",
//       orderStatus: "delivered",
//       createdAt: { $gte: start, $lte: end }
//     });

//     if (format === "csv") {
//       let csv = "Order ID,Date,Items,Subtotal,Discount,Total\n";

//       orders.forEach(o => {
//         csv += `${o.orderId},${o.createdAt.toISOString()},${o.items.length},${o.subtotal},${o.coupon?.discountAmount || 0},${o.totalAmount}\n`;
//       });

//       res.setHeader("Content-Type", "text/csv");
//       res.setHeader("Content-Disposition", "attachment; filename=sales-report.csv");
//       return res.send(csv);
//     }

//     if (format === "excel") {
//       const workbook = new ExcelJS.Workbook();
//       const sheet = workbook.addWorksheet("Sales Report");

//       sheet.addRow(["Order ID", "Date", "Items", "Subtotal", "Discount", "Total"]);

//       orders.forEach(o => {
//         sheet.addRow([
//           o.orderId,
//           o.createdAt.toISOString(),
//           o.items.length,
//           o.subtotal,
//           o.coupon?.discountAmount || 0,
//           o.totalAmount
//         ]);
//       });

//       res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
//       res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx");

//       return workbook.xlsx.write(res);
//     }

//     if (format === "pdf") {
//       const doc = new PDFDocument();
//       res.setHeader("Content-Type", "application/pdf");
//       res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");

//       doc.fontSize(18).text("Sales Report", { underline: true });

//       orders.forEach(order => {
//         doc.moveDown().fontSize(12).text(`
// Order ID: ${order.orderId}
// Date: ${order.createdAt}
// Subtotal: ${order.subtotal}
// Discount: ${order.coupon?.discountAmount || 0}
// Total: ${order.totalAmount}
//         `);
//       });

//       doc.pipe(res);
//       doc.end();
//     }

//   } catch (err) {
//     console.log("DOWNLOAD REPORT ERROR:", err);
//     res.json({ success: false, message: "Failed to download report" });
//   }
// };


// DOWNLOAD SALES REPORT - Option A (Simple table)
export const downloadSalesReport = async (req, res) => {
  try {
    const { fromDate, toDate, format } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "fromDate and toDate required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Use the same filter as list endpoint (no forced payment/order-state filtering)
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end }
    })
      .populate("user")
      .sort({ createdAt: -1 });

    // Prepare rows
    // Prepare rows
const rows = orders.map(o => {
  const dateStr = o.createdAt ? new Date(o.createdAt).toISOString() : "";
  const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
  const subtotal = typeof o.subtotal === "number" ? o.subtotal : 0;
  const couponDiscount = o.coupon?.discountAmount || 0;
  const offerDiscount = o.offerDiscount || 0;
  const totalDiscount = couponDiscount + offerDiscount;
  const total = typeof o.totalAmount === "number" ? o.totalAmount : 0;
  const paymentMethod = o.paymentMethod || "";
  const status = o.orderStatus || "";
const customer = o.user ? o.user.name || "Unknown" : "Unknown";

  const itemOrderId = o.items[0]?.itemOrderId || ""; // Get first item's itemOrderId
  
  return {
    orderId: o.orderId || "",
    itemOrderId: itemOrderId, // Add this
    date: dateStr,
    customer,
    items: itemsCount,
    subtotal,
    couponDiscount,
    offerDiscount,
    totalDiscount,
    total,
    paymentMethod,
    status
  };
});
//     const rows = orders.map(o => {
//       const dateStr = o.createdAt ? new Date(o.createdAt).toISOString() : "";
//       const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
//       const subtotal = typeof o.subtotal === "number" ? o.subtotal : 0;
//       // const discount = o.coupon?.discountAmount ?? 0;
//       const couponD = o.coupon?.discountAmount || 0;
// const offerD  = o.offerDiscount || 0;
// const discount = couponD + offerD;

//       const total = typeof o.totalAmount === "number" ? o.totalAmount : 0;
//       const paymentMethod = o.paymentMethod || "";
//       const status = o.orderStatus || o.orderStatus || o.orderStatus || o.orderStatus || (o.orderStatus ? o.orderStatus : (o.orderStatus || ""));
//       const customer = o.user ? `${o.user.name || ""} <${o.user.email || ""}>` : "";
//       return {
//         orderId: o.orderId || "",
//         date: dateStr,
//         customer,
//         items: itemsCount,
//         subtotal,
//         discount,
//         total,
//         paymentMethod,
//         status
//       };
//     });

    const filenameBase = `sales-report-${fromDate}-to-${toDate}`;

    // CSV
    if (format === "csv") {
      // Header
      const header = [
        "Order ID",
        "Date",
        "Customer",
        "Items",
        "Subtotal",
        "Discount",
        "Total",
        "Payment Method",
        "Status"
      ];
      const csvLines = [header.join(",")];

     rows.forEach((r) => {
  let x = startX;

  // Fixed row height
  const rowY = doc.y;

  const dateStr = r.date ? new Date(r.date).toLocaleDateString() : "";

  const rowData = [
    r.orderId,
    dateStr,
    r.customer,
    r.items.toString(),
    `₹${r.subtotal}`,
    `₹${r.couponDiscount || 0}`,
    `₹${r.offerDiscount || 0}`,
    `₹${r.total}`,
    r.paymentMethod,
    r.status
  ];

  let i = 0;

  Object.values(colWidths).forEach((w) => {
    const value = rowData[i];
    const alignRight = i >= 3 && i <= 7;

    doc.text(value, x, rowY, {
      width: w,
      align: alignRight ? "right" : "left"
    });

    x += w;
    i++;
  });

  // Set next row Y manually
  doc.y = rowY + rowHeight;

  // New page check
  if (doc.y > doc.page.height - 50) {
    doc.addPage();
    doc.y = 40;
  }
});

      const csv = csvLines.join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
      return res.send(csv);
    }

    // Excel (xlsx) - simple table
  if (format === "excel" || format === "xlsx") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Report");
  
  // Add headers
  sheet.columns = [
    { header: "Order ID", key: "orderId", width: 15 },
    { header: "Date", key: "date", width: 12 },
    { header: "Customer", key: "customer", width: 25 },
    { header: "Items", key: "items", width: 8 },
    { header: "Subtotal (₹)", key: "subtotal", width: 12 },
    { header: "Coupon Disc (₹)", key: "couponDiscount", width: 12 },
    { header: "Offer Disc (₹)", key: "offerDiscount", width: 12 },
    { header: "Total (₹)", key: "total", width: 12 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
    { header: "Status", key: "status", width: 12 }
  ];
  
  // Style header row
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E8E8E8' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  
  // Add data rows
  rows.forEach(r => {
    const row = sheet.addRow({
      orderId: r.orderId,
      date: new Date(r.date).toLocaleDateString(),
      customer: r.customer,
      items: r.items,
      subtotal: r.subtotal,
      couponDiscount: r.couponDiscount || 0,
      offerDiscount: r.offerDiscount || 0,
      total: r.total,
      paymentMethod: r.paymentMethod,
      status: r.status
    });
    
    // Style data cells
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      // Format number columns
      if (colNumber >= 5 && colNumber <= 8) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });
  
  // Set response headers
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
  
  // Write to response
  await workbook.xlsx.write(res);
  
  // Do NOT call res.end() here - ExcelJS will handle it
  return;
}
    // PDF (simple text table)
    
if (format === "pdf") {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filenameBase}.pdf"`
  );

  doc.pipe(res);

  /* ------------------ TITLE ------------------ */
  doc.fontSize(16).text("Sales Report", { align: "center" });
  doc.fontSize(10).text(`Period: ${fromDate} → ${toDate}`, { align: "center" });
  doc.moveDown(1.2);

  /* ------------------ COLUMN WIDTHS ------------------ */
  const colWidths = {
    orderId: 55,
    date: 55,
    customer: 90,
    items: 30,
    subtotal: 50,
    couponDisc: 50,
    offerDisc: 50,
    total: 50,
    payment: 50,
    status: 40
  };

  const headers = [
    "Order ID",
    "Date",
    "Customer",
    "Items",
    "Subtotal",
    "Coupon",
    "Offer",
    "Total",
    "Payment",
    "Status"
  ];

  const startX = 40;
  let y = doc.y;

  /* ------------------ DRAW HEADER ------------------ */
  doc.font("Helvetica-Bold").fontSize(9);
  let x = startX;

  Object.values(colWidths).forEach((w, i) => {
    doc.text(headers[i], x, y, { width: w, align: "center" });
    x += w;
  });

  doc.moveDown(1);
  y = doc.y;

  /* ------------------ DATA ROWS ------------------ */
  doc.font("Helvetica").fontSize(8);

  rows.forEach((r) => {
    const dateStr = r.date ? new Date(r.date).toLocaleDateString() : "";

    const rowData = [
      r.orderId,
      dateStr,
      r.customer,
      String(r.items),
      `₹${r.subtotal}`,
      `₹${r.couponDiscount}`,
      `₹${r.offerDiscount}`,
      `₹${r.total}`,
      r.paymentMethod,
      r.status
    ];

    /* ---------------------------------------------
       AUTO HEIGHT CALCULATION (IMPORTANT FIX)
    --------------------------------------------- */
    let maxHeight = 0;

    Object.values(colWidths).forEach((w, i) => {
      const value = rowData[i] || "";

      const height = doc.heightOfString(value, {
        width: w,
        align: i >= 3 && i <= 7 ? "right" : "left"
      });

      if (height > maxHeight) maxHeight = height;
    });

    /* ---------------------------------------------
       PAGE BREAK — BEFORE DRAWING ROW
    --------------------------------------------- */
    if (doc.y + maxHeight > doc.page.height - 60) {
      doc.addPage();
      doc.y = 40;
    }

    /* ---------------------------------------------
       DRAW THE ROW
    --------------------------------------------- */
    let drawX = startX;
    const drawY = doc.y;

    Object.values(colWidths).forEach((w, i) => {
      const value = rowData[i];

      const alignRight = i >= 3 && i <= 7;

      doc.text(value, drawX, drawY, {
        width: w,
        align: alignRight ? "right" : "left"
      });

      drawX += w;
    });

    /* Move cursor for next row */
    doc.y = drawY + maxHeight + 5;
  });

  doc.end();
  return;
}


    // Unsupported format
    return res.status(400).json({ success: false, message: "Unsupported format" });
  } catch (err) {
    console.error("DOWNLOAD REPORT ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to download report" });
  }
};
