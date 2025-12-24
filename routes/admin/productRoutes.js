

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


router.get('/', isAdminAuthenticated, listProducts);

/* -------------------- ADD PRODUCT -------------------- */
router.get('/add', isAdminAuthenticated, renderAddProduct);
router.post('/add', isAdminAuthenticated, upload.array('images', 20), addProduct);

router.get('/edit/:id', isAdminAuthenticated, renderEditProduct);
router.put('/edit/:id', isAdminAuthenticated, upload.array('images', 20), updateProduct);

router.post('/delete/:id', isAdminAuthenticated, deleteProduct);


router.post('/toggle-status/:id', isAdminAuthenticated, toggleProductStatus);


router.get('/categories/active', getActiveCategories);

/* -------------------- IMAGE ROUTES -------------------- */
router.post('/upload-image', upload.single('image'), uploadImage);
router.delete('/delete-image', deleteImage);

/* -------------------- GET PRODUCT BY ID (-------------------- */
router.get('/:id', isAdminAuthenticated, getProductById);

export default router;


