import express from "express";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Order from "../../models/orderModel.js";
import Coupon from "../../models/couponModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js";

const router = express.Router();

/* -----------------------------------------------------------
   GET CART (for checkout)
----------------------------------------------------------- */
// router.get("/cart", async (req, res) => {
//     try {
//         const userId = req.session.user?.id;
//         if (!userId) return res.json({ success: false });

//         const cart = await Cart.findOne({ user: userId })
//             .populate("items.product");

//         return res.json({
//             success: true,
//             cart: cart || { items: [] }
//         });

//     } catch (err) {
//         console.error("API CART ERROR:", err);
//         return res.json({ success: false });
//     }
// });

router.get("/cart", async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.json({ success: false });

        let cart = await Cart.findOne({ user: userId })
            .populate("items.product")
            .lean();

        if (!cart || !cart.items.length) {
            return res.json({ success: true, cart: { items: [] } });
        }

        // 🔥 APPLY OFFER TO EACH CART ITEM
        for (let item of cart.items) {
            const product = item.product;
            const variant = product.variants[item.variantIndex];

            const offerData = await applyOfferToProduct({
                ...product,
                variants: [variant] // apply only to this variant
            });

            const offerVariant = offerData.variants[0];

            item.finalPrice = offerVariant.finalPrice;     // discounted
            item.regularPrice = offerVariant.regularPrice; // original MRP
            item.totalFinal = offerVariant.finalPrice * item.quantity;
            item.appliedOffer = offerVariant.appliedOffer;
        }

        return res.json({
            success: true,
            cart
        });

    } catch (err) {
        console.error("CHECKOUT CART ERROR:", err);
        return res.json({ success: false, message: "Cart fetch failed" });
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
   PLACE ORDER — FINAL STABLE VERSION
----------------------------------------------------------- */
router.post("/orders", async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.json({ success: false, message: "User not login ❌" });

    const { addressId, paymentMethod, couponCode } = req.body;
    if (!addressId || !paymentMethod) return res.json({ success: false, message: "Missing data" });

    // Load cart (with product populated)
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items.length) return res.json({ success: false, message: "Cart empty" });

    const user = await User.findById(userId);
    const address = user.addresses.id(addressId);
    if (!address) return res.json({ success: false, message: "Address not found" });

    /* ------------------------------
       BUILD ORDER ITEMS (APPLY OFFERS)
       ------------------------------ */
    let orderItems = [];
    let subtotal = 0;
    let totalRegularPrice = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const variant = product.variants[cartItem.variantIndex];

      // Defensive: ensure variant exists
      if (!variant) {
        return res.json({ success: false, message: "Product variant not found" });
      }

      // Apply offer to this variant (applyOfferToProduct should return numeric prices)
      const offerData = await applyOfferToProduct({
        ...product.toObject(),
        variants: [variant]
      });
      const offerVariant = (offerData && offerData.variants && offerData.variants[0]) || {};

      // Fallbacks to avoid NaN
      const finalPrice = Number(offerVariant.finalPrice ?? variant.price ?? 0);
      const regularPrice = Number(offerVariant.regularPrice ?? (variant.mrp ?? variant.price) ?? finalPrice);
      const qty = Number(cartItem.quantity || 1);

      subtotal += finalPrice * qty;
      totalRegularPrice += regularPrice * qty;

      orderItems.push({
        product: product._id,
        variantIndex: cartItem.variantIndex,
        quantity: qty,
        price: +finalPrice.toFixed(2),         // discounted price (store)
        regularPrice: +regularPrice.toFixed(2),// original MRP (store)
        savings: +Math.max(0, (regularPrice - finalPrice) * qty).toFixed(2),
        appliedOffer: offerVariant.appliedOffer || null, // store offer metadata (if any)
        color: variant.color,
        image: variant.images?.[0]?.url || ""
      });
    }

    // Round subtotal
    subtotal = +subtotal.toFixed(2);
    const tax = +((subtotal * 0.1)).toFixed(2);
    const shippingFee = subtotal > 500 ? 0 : 50;

    /* ------------------------------
       COUPON CALCULATION
       ------------------------------ */
    let discountApplied = 0;
    let couponInfo = null;
    let couponDoc = null;

    if (couponCode) {
      couponDoc = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (!couponDoc) return res.json({ success: false, message: "Invalid coupon ❌" });

      const now = new Date();
      if (couponDoc.expiryDate && couponDoc.expiryDate < now) {
        return res.json({ success: false, message: "Coupon expired ❌" });
      }

      if (subtotal < (couponDoc.minOrderAmount || 0)) {
        return res.json({ success: false, message: `Minimum order ₹${couponDoc.minOrderAmount} required ❌` });
      }

      // percentage discount, capped by max discount
      const rawDiscount = (subtotal * (couponDoc.discountValue || 0)) / 100;
      discountApplied = Math.min(rawDiscount, couponDoc.maxDiscountAmount || rawDiscount);
      discountApplied = Math.round(discountApplied * 100) / 100;

      couponInfo = {
        code: couponDoc.code,
        discountValue: couponDoc.discountValue,
        discountAmount: discountApplied,
        maxDiscountAmount: couponDoc.maxDiscountAmount,
        subtotalBeforeCoupon: subtotal
      };
    }

    // Final amount
    const totalAmount = +((subtotal + tax + shippingFee - (discountApplied || 0))).toFixed(2);

    /* ------------------------------
       STOCK CHECK (before creating order)
       ------------------------------ */
    for (const cartItem of cart.items) {
      const prod = await Product.findById(cartItem.product._id);
      const variant = prod?.variants?.[cartItem.variantIndex];
      if (!variant) return res.json({ success: false, message: "Product/variant not found (stock check)" });

      const newStock = variant.stock - cartItem.quantity;
      if (newStock < 0) {
        return res.json({
          success: false,
          message: `Stock not available ❌ Only ${variant.stock} left for ${prod.name}`
        });
      }
    }

    /* ------------------------------
       CREATE ORDER (safe data stored)
       ------------------------------ */
    const customOrderId = "BH-" + Math.floor(100000 + Math.random() * 900000).toString();

    const order = await Order.create({
      orderId: customOrderId,
      user: userId,
      items: orderItems,
      shippingAddress: address,
      paymentMethod,
      subtotal,
      tax,
      shippingFee,
      totalAmount,
      totalRegularPrice: +totalRegularPrice.toFixed(2),
      totalSavings: +(Math.max(0, totalRegularPrice - subtotal) + (discountApplied || 0)).toFixed(2),
      coupon: couponInfo,
      paymentStatus: paymentMethod === "cod" ? "pending" : "paid"
    });

    // Ensure each order item has itemOrderId
    let needSave = false;
    order.items = order.items.map((it, idx) => {
      if (!it.itemOrderId) {
        it.itemOrderId = `${order.orderId}-${idx + 1}`;
        needSave = true;
      }
      return it;
    });
    if (needSave) await order.save();

    /* ------------------------------
       UPDATE STOCK (now reduce)
       ------------------------------ */
    for (const cartItem of cart.items) {
      const prod = await Product.findById(cartItem.product._id);
      const variant = prod.variants[cartItem.variantIndex];
      variant.stock = variant.stock - cartItem.quantity;
      prod.markModified(`variants.${cartItem.variantIndex}.stock`);
      await prod.save();
    }

    /* ------------------------------
       UPDATE COUPON USAGE (after success)
       ------------------------------ */
    if (couponDoc) {
      // re-fetch to avoid race issues (optional)
      const coupon = await Coupon.findOne({ _id: couponDoc._id });
      if (coupon) {
        // expiry / usage rechecks
        const now = new Date();
        if (coupon.expiryDate && coupon.expiryDate < now) {
          // coupon expired after validation — just continue but don't increment usage
        } else {
          // user usage
          const userRecord = coupon.usedByUsers.find(u => u.userId.toString() === userId.toString());
          coupon.usedCount = (coupon.usedCount || 0) + 1;
          if (userRecord) userRecord.count = (userRecord.count || 0) + 1;
          else coupon.usedByUsers.push({ userId, count: 1 });

          await coupon.save();
        }
      }
    }

    // clear cart only after everything succeeded
    cart.items = [];
    await cart.save();

    return res.json({
      success: true,
      orderId: order._id,
      customOrderId: order.orderId,
      message: "Order placed successfully",
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res.json({
      success: false,
      message: "Order failed",
      error: err.message,
    });
  }
});

export default router;