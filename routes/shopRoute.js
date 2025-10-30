import express from "express";
import { getShopPage } from "../controllers/user/shopController.js";

const router = express.Router();

router.get("/shop", getShopPage);
export default router;