import express from "express";
import{
    listCategories,renderAddCategory,addCategory,getCategory,updateCategory,softDeleteCategory,toggleCategoryStatus}from "../../controllers/admin/categoryController.js";

const router=express.Router();

// List all categories
router.get("/",listCategories);

//show add pages
router.get("/addCategory",renderAddCategory);

// Add a new category
router.post("/addCategory",addCategory);

// Get a single category by ID(edit)
router.get("/edit/:id",getCategory);

// Update a category 
router.post("/update/:id",updateCategory);

router.post("/toggleStatus", toggleCategoryStatus);
router.post("/delete/:id", softDeleteCategory);


export default router;

      