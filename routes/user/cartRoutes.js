import express from "express";
import { addToCart, updateCartQuantity, removeCartItem, clearCart, getCartPage} from "../../controllers/user/cartController.js";
import { isUserLoggedIn } from "../../middlewares/userAuth.js";


const router = express.Router();


router.get("/", isUserLoggedIn, getCartPage);
router.post("/add", isUserLoggedIn, addToCart);
router.put("/update/:id", isUserLoggedIn, updateCartQuantity);
router.delete("/remove/:itemId", isUserLoggedIn, removeCartItem);
router.delete("/clear", isUserLoggedIn, clearCart);

export default router;

