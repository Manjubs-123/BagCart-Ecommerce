import express from "express";
import { getSalesReport, downloadSalesReport } from "../../controllers/admin/salesReportController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";


const router = express.Router();

// Sales report page
router.get("/sales", isAdminAuthenticated, (req, res) => {
  res.render("admin/salesReport", {
    title: "Sales Report",
    currentPage: "sales"
  });
});

// Sales report data API
router.post("/sales", isAdminAuthenticated ,getSalesReport);

// Download sales report
router.post("/sales/download",isAdminAuthenticated, downloadSalesReport);

export default router;