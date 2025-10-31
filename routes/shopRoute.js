import express from "express";
import { getShopPage,getProductDetails,filterProducts} from "../controllers/user/shopController.js";

const router = express.Router();

router.get("/shop", getShopPage);
router.get("/product/:id", getProductDetails);
router.post("/shop/filter", filterProducts);
export default router;
