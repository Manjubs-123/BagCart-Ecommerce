import express from "express";
import multer from "multer";

const router = express.Router();

const upload = multer({ dest: "uploads/" }); // ✅ only one declaration

import {
  listProducts,
  renderAddProduct,
  addProduct,
  renderAddVariants,
  saveProduct,
  softDeleteProduct,
} from "../../controllers/admin/productController.js";

router.get("/", listProducts);
router.get("/add", renderAddProduct);
router.post("/add", addProduct);
router.get("/variants", renderAddVariants);
console.log("reached router in routes")
router.post("/save",upload.array("images", 5), saveProduct);
router.post("/delete/:id", softDeleteProduct);

export default router;
