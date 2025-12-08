import express from "express";
import {
    getOffers,
    getCreateOfferPage,
    postCreateOffer,
    getActiveProducts,
    getActiveCategories,
    toggleOfferStatus,
    deleteOffer,
    getEditOfferPage,
     updateOffer
} from "../../controllers/admin/offerController.js";

import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();

// OFFER LIST
router.get("/", isAdminAuthenticated, getOffers);

// AJAX PRODUCT & CATEGORY
router.get("/products", isAdminAuthenticated, getActiveProducts);
router.get("/categories", isAdminAuthenticated, getActiveCategories);

// CREATE OFFER
router.get("/create", isAdminAuthenticated, getCreateOfferPage);
router.post("/create", isAdminAuthenticated, postCreateOffer);

// TOGGLE STATUS  
router.post("/:id/toggle-status", isAdminAuthenticated, toggleOfferStatus);

router.delete("/:id", isAdminAuthenticated, deleteOffer);

// Edit page
router.get("/edit/:id", isAdminAuthenticated, getEditOfferPage);

// Update (PATCH)
router.patch("/:id", isAdminAuthenticated, updateOffer);

export default router;
