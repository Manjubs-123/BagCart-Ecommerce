import express from "express";
import { getWalletPage } from "../../controllers/user/walletController.js";
import { isUserLoggedIn } from "../../middlewares/userAuth.js";

const router = express.Router();

router.get("/wallet", isUserLoggedIn, getWalletPage);

export default router;
