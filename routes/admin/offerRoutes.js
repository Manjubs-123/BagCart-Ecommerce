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

router.get("/", isAdminAuthenticated, getOffers);


router.get("/products", isAdminAuthenticated, getActiveProducts);
router.get("/categories", isAdminAuthenticated, getActiveCategories);

router.get("/create", isAdminAuthenticated, getCreateOfferPage);
router.post("/create", isAdminAuthenticated, postCreateOffer);
 
router.post("/:id/toggle-status", isAdminAuthenticated, toggleOfferStatus);

router.delete("/:id", isAdminAuthenticated, deleteOffer);


router.get("/edit/:id", isAdminAuthenticated, getEditOfferPage);

router.patch("/:id", isAdminAuthenticated, updateOffer);

export default router;
