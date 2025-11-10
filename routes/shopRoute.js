import express from "express";
import { getShopPage,getProductDetails,filterProducts,getVariantByColor} from "../controllers/user/shopController.js";

const router = express.Router();

router.get("/shop", getShopPage);
router.get("/product/:id", getProductDetails);
router.post("/shop/filter", filterProducts);
router.get("/api/variant/:productId", getVariantByColor);
export default router;
