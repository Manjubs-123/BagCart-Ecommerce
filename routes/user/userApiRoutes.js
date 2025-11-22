import express from "express";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Order from "../../models/orderModel.js";

const router = express.Router();

/* -----------------------------------------------------------
   GET CART (for checkout)
----------------------------------------------------------- */
router.get("/cart", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false });

        const cart = await Cart.findOne({ user: userId })
            .populate("items.product");

        return res.json({
            success: true,
            cart: cart || { items: [] }
        });

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

        const user = await User.findById(userId).lean();

        return res.json({
            success: true,
            addresses: user.addresses || []
        });

    } catch (err) {
        console.log("ADDRESS ERROR:", err);
        return res.json({ success: false });
    }
});


/* -----------------------------------------------------------
   ADD ADDRESS
----------------------------------------------------------- */
router.post("/addresses", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);

        const newAddress = req.body;

        if (newAddress.isDefault) {
            user.addresses.forEach(a => (a.isDefault = false));
        }

        user.addresses.push(newAddress);
        await user.save();

        return res.json({
            success: true,
            address: user.addresses[user.addresses.length - 1]
        });

    } catch (err) {
        console.error("ADD ADDRESS ERROR", err);
        return res.json({ success: false });
    }
});


/* -----------------------------------------------------------
   WALLET BALANCE
----------------------------------------------------------- */
router.get("/wallet/balance", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId).lean();

        return res.json({
            success: true,
            balance: user.walletBalance || 0
        });

    } catch (err) {
        return res.json({ success: true, balance: 0 });
    }
});


/* -----------------------------------------------------------
   PLACE ORDER — SAFE VERSION
----------------------------------------------------------- */
router.post("/orders", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId || !paymentMethod) {
            return res.json({ success: false, message: "Missing data" });
        }

        const cart = await Cart.findOne({ user: userId })
            .populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Cart empty" });
        }

        // Get selected shipping address
        const user = await User.findById(userId);
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.json({ success: false, message: "Address not found" });
        }

        // Build order items
        const orderItems = cart.items.map(item => {
            const variant = item.product.variants[item.variantIndex];

            return {
                product: item.product._id,
                variantIndex: item.variantIndex,
                quantity: item.quantity,
                price: variant.price,
                color: variant.color,
                image: variant.images[0]?.url || ""
            };
        });

        // Calculate totals
        const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = subtotal * 0.1;
        const shippingFee = subtotal > 500 ? 0 : 50;
        const totalAmount = subtotal + tax + shippingFee;

        // Create order
        const order = await Order.create({
            user: userId,
            items: orderItems,
            shippingAddress: address,
            paymentMethod,
            subtotal,
            tax,
            shippingFee,
            totalAmount,
            paymentStatus: paymentMethod === "cod" ? "pending" : "paid"
        });

        // Clear cart
        cart.items = [];
        await cart.save();

        return res.json({
            success: true,
            orderId: order._id
        });

    } catch (err) {
        console.error("ORDER ERROR:", err);
        return res.json({ success: false, message: "Order failed" });
    }
});

export default router;
