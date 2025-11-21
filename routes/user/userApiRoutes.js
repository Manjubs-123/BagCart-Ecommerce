import express from "express";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";

const router = express.Router();

/* -----------------------------------------------------------
   GET CART – required for checkout page
----------------------------------------------------------- */
router.get("/cart", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false, message: "Not logged in" });

        const cart = await Cart.findOne({ user: userId })
            .populate("items.product");

        return res.json({ success: true, cart });
    } catch (err) {
        console.error("API CART ERROR:", err);
        return res.json({ success: false });
    }
});

/* -----------------------------------------------------------
   GET ADDRESSES
----------------------------------------------------------- */
router.get("/addresses", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false });

        const user = await User.findById(userId);
        return res.json({ success: true, addresses: user.addresses });
    } catch (err) {
        console.error("API ADDRESS ERROR:", err);
        return res.json({ success: false });
    }
});

/* -----------------------------------------------------------
   ADD ADDRESS
----------------------------------------------------------- */
router.post("/addresses", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false });

        const user = await User.findById(userId);

        // If setting as default → remove previous default
        if (req.body.isDefault) {
            user.addresses.forEach(a => (a.isDefault = false));
        }

        user.addresses.push(req.body);
        await user.save();

        const newAddress = user.addresses[user.addresses.length - 1];

        return res.json({ success: true, address: newAddress });

    } catch (err) {
        console.error("ADD ADDRESS ERROR:", err);
        return res.json({ success: false });
    }
});

/* -----------------------------------------------------------
   SET DEFAULT ADDRESS
----------------------------------------------------------- */
router.patch("/addresses/:id/default", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false });

        const user = await User.findById(userId);

        user.addresses.forEach(addr => {
            addr.isDefault = addr._id.toString() === req.params.id;
        });

        await user.save();
        res.json({ success: true });

    } catch (err) {
        console.error("DEFAULT ADDRESS ERROR:", err);
        res.json({ success: false });
    }
});

/* -----------------------------------------------------------
   DELETE ADDRESS
----------------------------------------------------------- */
router.delete("/addresses/:id", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const addressId = req.params.id;

        const user = await User.findById(userId);

        user.addresses = user.addresses.filter(
            a => a._id.toString() !== addressId
        );

        await user.save();
        res.json({ success: true });

    } catch (err) {
        console.error("DELETE ADDRESS ERROR:", err);
        res.json({ success: false });
    }
});

/* -----------------------------------------------------------
   WALLET BALANCE (TEMP – returns 0)
----------------------------------------------------------- */
router.get("/wallet/balance", (req, res) => {
    return res.json({ success: true, balance: 0 });
});

/* -----------------------------------------------------------
   PLACE ORDER
----------------------------------------------------------- */
router.post("/orders", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false });

        const { addressId, paymentMethod, items, totalAmount } = req.body;

        if (!addressId || !paymentMethod || !items?.length) {
            return res.json({
                success: false,
                message: "Missing order details"
            });
        }

        // 🔥 Create simple order object (no model)
        const order = {
            _id: new Date().getTime(),  // temporary ID
            userId,
            items,
            paymentMethod,
            addressId,
            totalAmount,
            status: "Placed"
        };

        // ❗ Clear cart after placing order
        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { items: [] } }
        );

        return res.json({
            success: true,
            message: "Order placed",
            order
        });

    } catch (err) {
        console.error("ORDER ERROR:", err);
        return res.json({ success: false, message: "Order failed" });
    }
});

export default router;
