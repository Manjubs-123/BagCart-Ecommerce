import express from "express";
import { getAvailableCoupons, applyCoupon } from "../../controllers/user/couponController.js";
import { isUserLoggedIn } from "../../middlewares/userAuth.js";
const router = express.Router();

router.get("/coupons/available", isUserLoggedIn, getAvailableCoupons);
router.post("/coupons/apply", isUserLoggedIn, applyCoupon);


export default router;