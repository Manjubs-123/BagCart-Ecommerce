import express from "express";
import { getCouponListPage ,createCoupon,getCreateCouponPage,getEditCouponPage,updateCoupon} from "../../controllers/admin/couponController.js"
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();


router.get("/",getCouponListPage)
router.get("/create",getCreateCouponPage);
router.get("/edit/:id",getEditCouponPage);
router.patch("/update/:id",updateCoupon);
router.post("/create",createCoupon);
// router.post("/coupons/create", createCoupon);

export default router;