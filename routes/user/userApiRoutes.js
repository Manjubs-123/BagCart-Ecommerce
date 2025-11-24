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


function isValidName(str) {
    return /^[A-Za-z ]{2,}$/.test(str);
}

function isValidCityOrState(str) {
    return /^[A-Za-z ]{2,}$/.test(str);
}

function isValidPhone(str) {
    return /^[6-9]\d{9}$/.test(str) &&
           !/^(\d)\1{9}$/.test(str) &&
           !isSequential(str);
}

function isValidPincode(str) {
    return /^\d{6}$/.test(str) &&
           !/^(\d)\1{5}$/.test(str) &&
           !isSequential(str);
}

function isSequential(str) {
    const nums = str.split("").map(Number);
    let asc = true, desc = true;

    for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[i - 1] + 1) asc = false;
        if (nums[i] !== nums[i - 1] - 1) desc = false;
    }
    return asc || desc;
}

/* -----------------------------------------------------------
   UPDATE ADDRESS (EDIT)
----------------------------------------------------------- */
// router.put("/addresses/:id", async (req, res) => {
//     try {
//         const userId = req.session.user?.id;
//         const addressId = req.params.id;

//         if (!userId) {
//             return res.json({ success: false, message: "Not logged in" });
//         }

//         const user = await User.findById(userId);
//         if (!user) {
//             return res.json({ success: false, message: "User not found" });
//         }

//         const updatedData = req.body;



//         // Make sure only 1 default exists
//         if (updatedData.isDefault) {
//             user.addresses.forEach(a => (a.isDefault = false));  
//         }

//         const address = user.addresses.id(addressId);
//         if (!address) {
//             return res.json({ success: false, message: "Address not found" });
//         }

//         // Update fields
//         address.fullName = updatedData.fullName;
//         address.phone = updatedData.phone;
//         address.addressLine1 = updatedData.addressLine1;
//         address.addressLine2 = updatedData.addressLine2;
//         address.city = updatedData.city;
//         address.state = updatedData.state;
//         address.pincode = updatedData.pincode;
//         address.country = updatedData.country;
//         address.addressType = updatedData.addressType;
//         address.isDefault = updatedData.isDefault;

//         await user.save();

//         return res.json({
//             success: true,
//             address
//         });

//     } catch (err) {
//         console.log("UPDATE ADDRESS ERROR:", err);
//         return res.json({ success: false });
//     }
// });

router.put("/addresses/:id", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const addressId = req.params.id;

        if (!userId) {
            return res.json({ success: false, message: "Not logged in" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const updatedData = req.body;

        // VALIDATION HERE
        if (!isValidName(updatedData.fullName))
            return res.json({ success: false, message: "Invalid full name" });

        if (!isValidPhone(updatedData.phone))
            return res.json({ success: false, message: "Invalid phone number" });

        if (!isValidCityOrState(updatedData.city))
            return res.json({ success: false, message: "Invalid city name" });

        if (!isValidCityOrState(updatedData.state))
            return res.json({ success: false, message: "Invalid state name" });

        if (!isValidPincode(updatedData.pincode))
            return res.json({ success: false, message: "Invalid pincode" });

        // Ensure only one default address
        if (updatedData.isDefault) {
            user.addresses.forEach(a => (a.isDefault = false));
        }

        const address = user.addresses.id(addressId);
        if (!address) {
            return res.json({ success: false, message: "Address not found" });
        }

        // Update fields
        address.fullName = updatedData.fullName;
        address.phone = updatedData.phone;
        address.addressLine1 = updatedData.addressLine1;
        address.addressLine2 = updatedData.addressLine2;
        address.city = updatedData.city;
        address.state = updatedData.state;
        address.pincode = updatedData.pincode;
        address.country = updatedData.country;
        address.addressType = updatedData.addressType;
        address.isDefault = updatedData.isDefault;

        await user.save();

        return res.json({ success: true, address });

    } catch (err) {
        console.log("UPDATE ADDRESS ERROR:", err);
        return res.json({ success: false });
    }
});



/* -----------------------------------------------------------
   ADD ADDRESS
----------------------------------------------------------- */
// router.post("/addresses", async (req, res) => {
//     try {
//         const userId = req.session.user.id;
//         const user = await User.findById(userId);

//         const newAddress = req.body;

//         if (newAddress.isDefault) {
//             user.addresses.forEach(a => (a.isDefault = false));
//         }

//         user.addresses.push(newAddress);
//         await user.save();

//         return res.json({
//             success: true,
//             address: user.addresses[user.addresses.length - 1]
//         });

//     } catch (err) {
//         console.error("ADD ADDRESS ERROR", err);
//         return res.json({ success: false });
//     }
// });

router.post("/addresses", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);

        const newAddress = req.body;

        // VALIDATION HERE
        if (!isValidName(newAddress.fullName))
            return res.json({ success: false, message: "Invalid full name" });

        if (!isValidPhone(newAddress.phone))
            return res.json({ success: false, message: "Invalid phone number" });

        if (!isValidCityOrState(newAddress.city))
            return res.json({ success: false, message: "Invalid city name" });

        if (!isValidCityOrState(newAddress.state))
            return res.json({ success: false, message: "Invalid state name" });

        if (!isValidPincode(newAddress.pincode))
            return res.json({ success: false, message: "Invalid pincode" });

        // Ensure only one default
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

        const user = await User.findById(userId);
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.json({ success: false, message: "Address not found" });
        }

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

        const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = subtotal * 0.1;
        const shippingFee = subtotal > 500 ? 0 : 50;
        const totalAmount = subtotal + tax + shippingFee;

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

        // ✅ STOCK REDUCTION LOGIC HERE
        for (let item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (!product) continue;

            const variant = product.variants[item.variantIndex];
            if (!variant) continue;

            variant.stock -= item.quantity;
            product.markModified(`variants.${item.variantIndex}.stock`);

            await product.save();
        }

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
