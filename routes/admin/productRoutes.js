// import express from "express";
// import multer from "multer";

// const router = express.Router();

// const upload = multer({ dest: "uploads/" }); // ✅ only one declaration

// import {
//   listProducts,
//   renderAddProduct,
//   addProduct,
//   renderAddVariants,
//   saveProduct,
//   softDeleteProduct,
// } from "../../controllers/admin/productController.js";

// router.get("/", listProducts);
// router.get("/add", renderAddProduct);
// router.post("/add", addProduct);
// router.get("/variants", renderAddVariants);
// console.log("reached router in routes")
// router.post("/save",upload.array("images", 5), saveProduct);
// router.post("/delete/:id", softDeleteProduct);

// export default router;
import express from 'express';
import { 
  getProducts, 
  getProductById,
  getActiveCategories,
  addProduct, 
  updateProduct, 
  deleteProduct,
  uploadImage,
  deleteImage
} from '../../controllers/admin/productController.js';
import { upload } from "../../config/cloudinary.js";



const router = express.Router();

// Product routes (rooted) - mounted at /admin/products in index.js
router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', addProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Soft-delete via POST to match frontend calls
router.post('/delete/:id', deleteProduct);

// Category routes
router.get('/categories/active', getActiveCategories);

// Image routes
router.post('/upload-image', upload.single('image'), uploadImage);
router.delete('/delete-image', deleteImage);

export default router;