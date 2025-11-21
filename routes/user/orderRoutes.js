import express from "express";
import { placeOrder,getOrderConfirmation,getOrderDetails } from "../../controllers/user/orderController.js";
import { isUserLoggedIn } from "../../middlewares/userAuth.js";
const router = express.Router();

router.post("/api/orders", isUserLoggedIn, placeOrder);
router.get("/confirmation/:id", isUserLoggedIn, getOrderConfirmation);
router.get("/details/:id", isUserLoggedIn, getOrderDetails);
 
export default router;