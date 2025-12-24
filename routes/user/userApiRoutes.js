import express from "express";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Order from "../../models/orderModel.js";
import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js";
import { getCart } from "../../controllers/user/cartController.js";
import { addAddresses, getAddresses, updateAddresses } from "../../controllers/user/userController.js";
import { getWalletBalance } from "../../controllers/user/walletController.js";
import { createOrder } from "../../controllers/user/orderController.js";

const router = express.Router();

/* -----------------------------------------------------------
   GET CART 
----------------------------------------------------------- */

router.get("/cart", getCart);


/* -----------------------------------------------------------
   GET ADDRESSES
------------------------n----------------------------------- */
router.get("/addresses", getAddresses);


/* -----------------------------------------------------------
   UPDATE ADDRESS 
----------------------------------------------------------- */
router.put("/addresses/:id", updateAddresses);



/* -----------------------------------------------------------
   ADD ADDRESS
----------------------------------------------------------- */
router.post("/addresses", addAddresses);


/* -----------------------------------------------------------
   WALLET BALANCE
----------------------------------------------------------- */


router.get("/wallet/balance", getWalletBalance);


/* -----------------------------------------------------------
   PLACE ORDER — FINAL STABLE VERSION
----------------------------------------------------------- */

router.post("/orders",createOrder);


export default router;