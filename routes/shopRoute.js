import express from "express";
import { getShopPage,getProductDetails,filterProducts,getVariantByColor} from "../controllers/user/shopController.js";
import { isUserLoggedIn } from "../middlewares/userAuth.js";
const router = express.Router();

router.get("/shop", getShopPage);
router.get("/product/:id", isUserLoggedIn,getProductDetails);
router.post("/shop/filter", filterProducts);
router.get("/api/variant/:productId", getVariantByColor);
export default router;
