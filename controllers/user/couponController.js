import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js";
import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Cart from "../../models/cartModel.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";



// export const getAvailableCoupons = async (req, res) => {
//   try {
//     const now = new Date(Date.now());


//     const coupons = await Coupon.find({
//       isActive: true,
//       validTo: { $gte: now },
//       $or: [
//         { maxUsage: null },
//         { $expr: { $lt: ["$usedCount", "$maxUsage"] } }
//       ]
//     }).lean();


//     console.log("NOW:", now, typeof now);

//     coupons.forEach(c => {
//       console.log({
//         code: c.code,
//         validFrom: c.validFrom,
//         validFromType: typeof c.validFrom,
//         validTo: c.validTo,
//         validToType: typeof c.validTo,
//       });
//     });


//     const validCouponsNow = coupons.filter(coupon => {
//       return (
//         (!coupon.validFrom || coupon.validFrom <= now) &&
//         (!coupon.validTo || coupon.validTo >= now)
//       );
//     });



//     return res.json({ success: true, coupons: validCouponsNow });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false });
//   }
// };
export const getAvailableCoupons = async (req, res) => {
  try {
     const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);


    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now },
      $or: [
        { maxUsage: null },
        { $expr: { $lt: ["$usedCount", "$maxUsage"] } }
      ]
    }).lean();
    // console.log(now)
    // console.log(coupons[1].validFrom)

    console.log("Fetched coupons:", coupons.length);

    console.log(
      "Valid coupons at",
      now.toISOString(),
      coupons.map(c => c.code)
    );

    return res.json({
      success: true,
      coupons
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
};

export const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    let { couponCode } = req.body;
    couponCode = couponCode?.toUpperCase();
     const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);


    console.log("Applying coupon:", couponCode, "for user:", userId);
    //fetch cart and calculate total
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart empty " });
    }

    let cartTotal = 0;
    cart.items.forEach(item => {
      const variant = item.product.variants[item.variantIndex];
      cartTotal += variant.price * item.quantity;
    });

    console.log("Cart total:", cartTotal);

    const coupon = await Coupon.findOne({
      code: couponCode,
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    });

    if (!coupon) {
      console.log("Coupon not found:", couponCode);
      return res.json({ success: false, message: "Invalid or expired coupon " });
    }

    console.log(" Coupon found:", coupon.code, "Min order:", coupon.minOrderAmount);

    if (cartTotal < coupon.minOrderAmount) {
      return res.json({
        success: false,
        message: `Minimum order amount ₹${coupon.minOrderAmount} required! Add ₹${(coupon.minOrderAmount - cartTotal).toFixed(2)} more.`
      });
    }
    //global usage limit check
    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      return res.json({
        success: false,
        message: "This coupon has reached its maximum usage limit"
      });
    }
    //per user usage
    const userUsageCount = await Order.countDocuments({
      user: userId,
      'coupon.code': couponCode,
      status: { $nin: ['cancelled', 'failed'] }
    });

    if (coupon.maxUsagePerUser && userUsageCount >= coupon.maxUsagePerUser) {
      return res.json({
        success: false,
        message: `You can only use this coupon ${coupon.maxUsagePerUser} time(s)`
      });
    }

    //discount calculation
    const discountAmount = Math.min(
      (cartTotal * coupon.discountValue) / 100,
      coupon.maxDiscountAmount
    );

    console.log(" Discount calculated:", discountAmount);

    return res.json({
      success: true,
      coupon: {
        ...coupon.toObject(),
        discountAmount: discountAmount
      },
      discountAmount: discountAmount
    });

  } catch (err) {
    console.error(" Coupon apply error:", err);
    return res.status(500).json({ success: false, message: "Coupon apply failed" });
  }
};