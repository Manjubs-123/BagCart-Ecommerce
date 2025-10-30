
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
  renderAddProduct,
  renderEditProduct,
  toggleProductStatus,
  listProducts
} from '../../controllers/admin/productController.js';
import { isAdminAuthenticated } from '../../middlewares/adminAuth.js';  
import { upload } from "../../config/cloudinary.js";


const router = express.Router();


router.get('/', isAdminAuthenticated, listProducts);
// Product routes (rooted) - mounted at /admin/products in index.js
router.get('/', isAdminAuthenticated, getProducts);
// Render Add Product page BEFORE the dynamic :id route so 'add' isn't treated as an id
router.get('/add', isAdminAuthenticated, renderAddProduct);
router.get('/:id', isAdminAuthenticated, getProductById);
router.post('/add', isAdminAuthenticated,upload.array('images', 20) , addProduct);


// Show the Edit Product page (GET)

router.get('/edit/:id', isAdminAuthenticated, renderEditProduct);

// Handle Edit Product form submission (POST or PUT)
router.post('/edit/:id', isAdminAuthenticated, upload.array('images', 20), updateProduct);

router.delete('/:id', isAdminAuthenticated, deleteProduct);

// Soft-delete via POST to match frontend calls
router.post('/delete/:id', isAdminAuthenticated, deleteProduct);

// Category routes
router.get('/categories/active', getActiveCategories);

// Image routes
router.post('/upload-image', upload.single('image'), uploadImage);
router.delete('/delete-image', deleteImage);

router.post('/toggle-status/:id', isAdminAuthenticated, toggleProductStatus);
export default router;


