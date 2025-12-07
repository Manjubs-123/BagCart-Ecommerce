// import express  from "express";
// import { getSalesReport ,downloadSalesReport} from "../../controllers/admin/salesReportController.js";
// import {isAdminAuthenticated} from "../../middlewares/adminAuth.js";
// // const router = express.Router();
// // router.get("/sales-report", isAdminAuthenticated, getSalesReport);
// // router.post("/sales", isAdminAuthenticated, getSalesReport);
// // router.post("/download", isAdminAuthenticated, downloadSalesReport);
// // export default router;


// const router = express.Router();

// // Load Sales Report UI
// router.get("/sales-report", isAdminAuthenticated, (req, res) => {
//     res.render("admin/salesReport");
// });

// // Fetch Sales Data
// router.post("/sales", isAdminAuthenticated, getSalesReport);

// // Download Report
// router.post("/sales/download", isAdminAuthenticated, downloadSalesReport);

// export default router;


import express from "express";
import { getSalesReport, downloadSalesReport } from "../../controllers/admin/salesReportController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();

// Render Sales Report Page
router.get("/sales-report", isAdminAuthenticated, (req, res) => {
    res.render("admin/salesReport", { 
        title: "Sales Report",
        currentPage: "sales-report"
    });
});

// API: Get Sales Report Data
router.post("/sales", isAdminAuthenticated, getSalesReport);

// API: Download Report (Excel/PDF)
router.post("/sales/download", isAdminAuthenticated, downloadSalesReport);

export default router;