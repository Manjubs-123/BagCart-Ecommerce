import express from "express";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Order from "../../models/orderModel.js";
import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js"; 
import { applyOfferToProduct } from "../../utils/applyOffer.js";
import { getCart } from "../../controllers/user/cartController.js";

const router = express.Router();

/* -----------------------------------------------------------
   GET CART 
----------------------------------------------------------- */

router.get("/cart", getCart);


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
   UPDATE ADDRESS 
----------------------------------------------------------- */
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

       
        if (updatedData.isDefault) {
            user.addresses.forEach(a => (a.isDefault = false));
        }

        const address = user.addresses.id(addressId);
        if (!address) {
            return res.json({ success: false, message: "Address not found" });
        }

        
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
router.post("/addresses", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);

        const newAddress = req.body;

        
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

        const wallet = await Wallet.findOne({ user: userId }).lean();

        return res.json({
            success: true,
            balance: wallet?.balance || 0
        });

    } catch (err) {
        return res.json({ success: false, balance: 0 });
    }
});


/* -----------------------------------------------------------
   PLACE ORDER — FINAL STABLE VERSION
----------------------------------------------------------- */

router.post("/orders", async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.json({ success: false, message: "User not logged in" });
    }

    const { addressId, paymentMethod, couponCode } = req.body;

    if (!addressId || !paymentMethod) {
      return res.json({
        success: false,
        message: "Delivery address and payment method required"
      });
    }

    /* ------------------------------
       LOAD CART
    ------------------------------ */
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const user = await User.findById(userId);
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.json({ success: false, message: "Address not found" });
    }

    /* ------------------------------
       BUILD ORDER ITEMS
    ------------------------------ */
    let orderItems = [];
    let subtotal = 0;
    let totalRegularPrice = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const variant = product.variants[cartItem.variantIndex];
      if (!variant) {
        return res.json({ success: false, message: "Product variant not found" });
      }

      const offerData = await applyOfferToProduct({
        ...product.toObject(),
        variants: [variant]
      });

      const offerVariant = offerData?.variants?.[0] || {};
      const finalPrice = Number(offerVariant.finalPrice ?? variant.price);
      const regularPrice = Number(
        offerVariant.regularPrice ?? variant.mrp ?? variant.price
      );
      const qty = Number(cartItem.quantity);

      subtotal += finalPrice * qty;
      totalRegularPrice += regularPrice * qty;

      orderItems.push({
        product: product._id,
        variantIndex: cartItem.variantIndex,
        quantity: qty,
        price: +finalPrice.toFixed(2),
        regularPrice: +regularPrice.toFixed(2),
        savings: +((regularPrice - finalPrice) * qty).toFixed(2),
        color: variant.color,
        image: variant.images?.[0]?.url || ""
      });
    }

    subtotal = +subtotal.toFixed(2);
    const tax = +(subtotal * 0.1).toFixed(2);
    const shippingFee = subtotal > 500 ? 0 : 50;

    /* ------------------------------
       COUPON
    ------------------------------ */
    let discountApplied = 0;
    let couponInfo = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true
      });

      if (!coupon) {
        return res.json({ success: false, message: "Invalid coupon" });
      }

      if (coupon.expiryDate < new Date()) {
        return res.json({ success: false, message: "Coupon expired" });
      }

      if (subtotal < coupon.minOrderAmount) {
        return res.json({
          success: false,
          message: `Minimum order ₹${coupon.minOrderAmount} required`
        });
      }

      const rawDiscount = (subtotal * coupon.discountValue) / 100;
      discountApplied = Math.min(rawDiscount, coupon.maxDiscountAmount);

      couponInfo = {
        code: coupon.code,
        discountAmount: +discountApplied.toFixed(2)
      };
    }

    const totalAmount = +(
      subtotal + tax + shippingFee - discountApplied
    ).toFixed(2);

    /* ------------------------------
       COD BLOCK
    ------------------------------ */
    if (paymentMethod === "cod" && totalAmount > 1000) {
      return res.json({
        success: false,
        message: "COD not available above ₹1000"
      });
    }

    /* ------------------------------
       WALLET BALANCE CHECK
    ------------------------------ */
    if (paymentMethod === "wallet") {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet || wallet.balance < totalAmount) {
        return res.json({
          success: false,
          message: "Insufficient wallet balance"
        });
      }
    }




    /* ------------------------------
       CREATE ORDER
    ------------------------------ */
    const order = await Order.create({
      orderId: "BH-" + Math.floor(100000 + Math.random() * 900000),
      user: userId,
      items: orderItems,
      shippingAddress: address,
      paymentMethod,
      subtotal,
      tax,
      shippingFee,
      totalAmount,
      coupon: couponInfo,
      paymentStatus:
        paymentMethod === "wallet" ? "paid" : "pending",
      orderStatus: "pending"
    });

    /* ------------------------------
       WALLET PAYMENT FINALIZE
    ------------------------------ */
    if (paymentMethod === "wallet") {

         /* ------------------------------
   STOCK DEDUCTION (FINAL)
------------------------------ */
for (const cartItem of cart.items) {
  const product = await Product.findById(cartItem.product._id);
  if (!product) continue;

  const variant = product.variants[cartItem.variantIndex];
  if (!variant) continue;

  variant.stock -= cartItem.quantity;

  if (variant.stock < 0) variant.stock = 0;

  product.markModified(`variants.${cartItem.variantIndex}.stock`);
  await product.save();
}
      const wallet = await Wallet.findOne({ user: userId });
      wallet.balance -= totalAmount;
      wallet.transactions.push({
        type: "debit",
        amount: totalAmount,
        description: `Order ${order.orderId}`,
        status: "success"
      });
      await wallet.save();

      order.orderStatus = "confirmed";
      await order.save();
    }

    /* ------------------------------
       CLEAR CART
    ------------------------------ */
    cart.items = [];
    await cart.save();

    /* ------------------------------
       RESPONSE
    ------------------------------ */
    return res.json({
      success: true,
      orderId: order._id,
      customOrderId: order.orderId,
      totalAmount: order.totalAmount,
      razorpayAmount:
        paymentMethod === "razorpay"
          ? order.totalAmount * 100
          : null,
      paymentPending: paymentMethod === "razorpay"
    });

  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res.json({
      success: false,
      message: "Order failed"
    });
  }
});


export default router;