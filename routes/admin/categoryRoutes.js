import express from "express";
import{
    listCategories,renderAddCategory,addCategory,getCategory,updateCategory,softDeleteCategory,toggleCategoryStatus}from "../../controllers/admin/categoryController.js";

    import{isAdminAuthenticated}from"../../middlewares/adminAuth.js";

const router=express.Router();

// List all categories
router.get("/",isAdminAuthenticated,listCategories);

//show add pages
router.get("/addCategory",isAdminAuthenticated,isAdminAuthenticated,renderAddCategory);

// Add a new category
router.post("/addCategory",isAdminAuthenticated,addCategory);

router.get("/edit/:id",isAdminAuthenticated,getCategory);

// Update a category 
router.patch("/update/:id",isAdminAuthenticated,updateCategory);

router.post("/toggleStatus", isAdminAuthenticated,toggleCategoryStatus);
router.post("/delete/:id",isAdminAuthenticated, softDeleteCategory);


export default router;

      