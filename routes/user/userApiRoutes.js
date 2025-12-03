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
    if (!userId)
      return res.json({ success: false, message: "User not login ❌" });

    const { addressId, paymentMethod, couponCode } = req.body;

    if (!addressId || !paymentMethod) {
      return res.json({ success: false, message: "Missing data" });
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart empty" });
    }

    const user = await User.findById(userId);
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.json({ success: false, message: "Address not found" });
    }

    /* -----------------------------------------------------------
       BUILD ORDER ITEMS (APPLY OFFERS)
    ----------------------------------------------------------- */
    let orderItems = [];
    let subtotal = 0;
    let totalRegularPrice = 0;

    for (let item of cart.items) {
      const product = item.product;
      const variant = product.variants[item.variantIndex];

      // Apply offer to this variant (ensure applyOfferToProduct is imported)
      const offerData = await applyOfferToProduct({
        ...product.toObject(),
        variants: [variant]
      });

      const offerVariant = offerData.variants[0];

      const regularPrice = offerVariant.regularPrice;
      const finalPrice = offerVariant.finalPrice;
      const qty = item.quantity;

      subtotal += finalPrice * qty;
      totalRegularPrice += regularPrice * qty;

      orderItems.push({
        product: product._id,
        variantIndex: item.variantIndex,
        quantity: qty,

        regularPrice,       // original MRP
        price: finalPrice,  // discounted price
        savings: (regularPrice - finalPrice) * qty,  // item-level savings

        color: variant.color,
        image: variant.images?.[0]?.url || ""
      });
    }

    /* -----------------------------------------------------------
       PRICE CALCULATION
       (use the subtotal we already computed above — do NOT redeclare)
    ----------------------------------------------------------- */
    // const subtotal = orderItems.reduce(...); // <-- REMOVED duplicate declaration
    const tax = subtotal * 0.1; // 10% GST
    const shippingFee = subtotal > 500 ? 0 : 50;

    /* -----------------------------------------------------------
       COUPON CALCULATION (REQUIRED + CLEAN)
    ----------------------------------------------------------- */
    let discountApplied = 0;
    let couponInfo = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });

      if (!coupon) {
        return res.json({
          success: false,
          message: "Invalid coupon ❌",
        });
      }

      const now = new Date();
      if (coupon.expiryDate < now) {
        return res.json({
          success: false,
          message: "Coupon expired ❌",
        });
      }

      if (subtotal < (coupon.minOrderAmount || 0)) {
        return res.json({
          success: false,
          message: `Minimum order ₹${coupon.minOrderAmount} required ❌`,
        });
      }

      // percentage discount, capped by max discount
      const rawDiscount = (subtotal * coupon.discountValue) / 100;
      discountApplied = Math.min(rawDiscount, coupon.maxDiscountAmount);

      discountApplied = Math.round(discountApplied * 100) / 100;

      couponInfo = {
        code: coupon.code,
        discountValue: coupon.discountValue,
        discountAmount: discountApplied,
        maxDiscountAmount: coupon.maxDiscountAmount,
        subtotalBeforeCoupon: subtotal,
      };
    }

    const finalTotal = subtotal + tax + shippingFee - (discountApplied || 0);

    /* -----------------------------------------------------------
       GENERATE CUSTOM ORDER ID
    ----------------------------------------------------------- */
    const customOrderId =
      "BH-" + Math.floor(100000 + Math.random() * 900000).toString();

    /* -----------------------------------------------------------
       CREATE ORDER
    ----------------------------------------------------------- */
    const order = await Order.create({
      orderId: customOrderId,
      user: userId,
      items: orderItems,
      shippingAddress: address,
      paymentMethod,

      subtotal,
      tax,
      shippingFee,
      totalAmount: finalTotal,

      // helpful to store these so confirmation page can show savings
      totalRegularPrice,
      totalSavings: Math.max(0, totalRegularPrice - subtotal + (discountApplied || 0)),

      coupon: couponInfo,

      paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
    });

    /* -----------------------------------------------------------
       UPDATE STOCK
    ----------------------------------------------------------- */
    for (let item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product) continue;

      const variant = product.variants[item.variantIndex];
      if (!variant) continue;

      const newStock = variant.stock - item.quantity;

      if (newStock < 0) {
        return res.json({
          success: false,
          message: `Stock not available ❌ Only ${variant.stock} left`,
        });
      }

      variant.stock = newStock;
      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save();
    }

    /* -----------------------------------------------------------
       UPDATE COUPON USAGE IN DATABASE
    ----------------------------------------------------------- */
    if (couponCode && couponInfo) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
      });

      if (coupon) {
        const userRecord = coupon.usedByUsers.find(
          (u) => u.userId.toString() === userId.toString()
        );

        coupon.usedCount += 1;

        if (userRecord) {
          userRecord.count += 1;
        } else {
          coupon.usedByUsers.push({ userId, count: 1 });
        }

        await coupon.save();
      }
    }

    /* -----------------------------------------------------------
       SUCCESS RESPONSE
    ----------------------------------------------------------- */
    // clear cart items (optional, handled elsewhere in some versions)
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