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
  deleteImage,
  renderAddProduct
} from '../../controllers/admin/productController.js';
import { isAdminAuthenticated } from '../../middlewares/adminAuth.js';  
import { upload } from "../../config/cloudinary.js";


const router = express.Router();

// Product routes (rooted) - mounted at /admin/products in index.js
router.get('/', isAdminAuthenticated, getProducts);
// Render Add Product page BEFORE the dynamic :id route so 'add' isn't treated as an id
router.get('/add', isAdminAuthenticated, renderAddProduct);
router.get('/:id', isAdminAuthenticated, getProductById);
router.post('/add', isAdminAuthenticated,upload.array('images', 20) , addProduct);
router.put('/:id', isAdminAuthenticated, updateProduct);
router.delete('/:id', isAdminAuthenticated, deleteProduct);

// Soft-delete via POST to match frontend calls
router.post('/delete/:id', isAdminAuthenticated, deleteProduct);

// Category routes
router.get('/categories/active', getActiveCategories);

// Image routes
router.post('/upload-image', upload.single('image'), uploadImage);
router.delete('/delete-image', deleteImage);

export default router;