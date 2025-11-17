import express from "express";
import { getShopPage, getProductDetails, filterProducts, getVariantByColor } from "../../controllers/user/shopController.js";
import { isUserLoggedIn } from "../../middlewares/userAuth.js";
const router = express.Router();

router.get("/shop", isUserLoggedIn, getShopPage);
router.get("/product/:id", isUserLoggedIn, getProductDetails);
router.post("/shop/filter", isUserLoggedIn, filterProducts);
router.get("/api/variant/:productId", isUserLoggedIn, getVariantByColor);
export default router;
