

import express from 'express';
import { 
  getProductById,
  getActiveCategories,
  addProduct, 
  updateProduct, 
  deleteProduct,
  uploadImage,
  deleteImage,
  renderAddProduct,
  renderEditProduct,
  toggleProductStatus,
  listProducts
} from '../../controllers/admin/productController.js';

import { isAdminAuthenticated } from '../../middlewares/adminAuth.js';  
import { upload } from "../../config/cloudinary.js";

const router = express.Router();

/* -------------------- PRODUCT LIST -------------------- */
router.get('/', isAdminAuthenticated, listProducts);

/* -------------------- ADD PRODUCT -------------------- */
router.get('/add', isAdminAuthenticated, renderAddProduct);
router.post('/add', isAdminAuthenticated, upload.array('images', 20), addProduct);

/* -------------------- EDIT PRODUCT -------------------- */
router.get('/edit/:id', isAdminAuthenticated, renderEditProduct);
router.put('/edit/:id', isAdminAuthenticated, upload.array('images', 20), updateProduct);

/* -------------------- DELETE PRODUCT -------------------- */
// KEEP ONLY ONE (POST soft-delete)
router.post('/delete/:id', isAdminAuthenticated, deleteProduct);

/* -------------------- TOGGLE ACTIVE/INACTIVE -------------------- */
router.post('/toggle-status/:id', isAdminAuthenticated, toggleProductStatus);

/* -------------------- CATEGORY ROUTES -------------------- */
router.get('/categories/active', getActiveCategories);

/* -------------------- IMAGE ROUTES -------------------- */
router.post('/upload-image', upload.single('image'), uploadImage);
router.delete('/delete-image', deleteImage);

/* -------------------- GET PRODUCT BY ID (-------------------- */
router.get('/:id', isAdminAuthenticated, getProductById);

export default router;


