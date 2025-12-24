import express from "express";
import { getCouponListPage ,createCoupon,getCreateCouponPage,getEditCouponPage,updateCoupon,toggleCouponStatus} from "../../controllers/admin/couponController.js"
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();


router.get("/",isAdminAuthenticated,getCouponListPage)
router.get("/create",isAdminAuthenticated,getCreateCouponPage);
router.get("/edit/:id",isAdminAuthenticated,getEditCouponPage);
router.patch("/update/:id",isAdminAuthenticated,updateCoupon);
router.post("/create",isAdminAuthenticated,createCoupon);
router.post("/toggle/:id",isAdminAuthenticated,toggleCouponStatus);


export default router;