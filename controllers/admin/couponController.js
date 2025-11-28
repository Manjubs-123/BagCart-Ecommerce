import Coupon from "../../models/couponModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
// GET: Show create coupon form

export const getCouponListPage = async (req, res) => {
  try {
    const { q="", status="", type="", sort="", page=1, limit=10 } = req.query;
    const now = new Date();

    let query = {};

    if (q.trim()) {
      query.code = { $regex: q.trim(), $options: "i" };
    }

    if (type === "percentage") query.discountType = "PERCENTAGE";
    if (type === "fixed") query.discountType = "FIXED";
    if (type === "free_shipping") query.discountType = "FREE_SHIPPING";

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (status === "expired") query.expiryDate = { $lt: now };

    let sortQuery = {};
    if (sort === "newest") sortQuery.createdAt = -1;
    if (sort === "discountHigh") sortQuery.discountValue = -1;
    if (sort === "expiryNear") sortQuery.expiryDate = 1;

    const coupons = await Coupon.find(query)
      .sort(sortQuery)
      .skip((page-1)*limit)
      .limit(limit)
      .lean();

    res.render("admin/couponList", {
      coupons,
      totalCoupons: await Coupon.countDocuments(query),
      activeCoupons: await Coupon.countDocuments({ ...query, isActive:true }),
      expiredCoupons: await Coupon.countDocuments({ ...query, expiryDate:{ $lt:now }}),
      totalUsage: coupons.reduce((a,c)=>a+(c.usedCount||0),0),
      q, statusFilter:status, typeFilter:type, sort,
      page:Number(page), limit:Number(limit), pages:1
    });

  } catch (err) {
    console.error("🔥 LIST PAGE ERROR:", err.message);
    res.status(500).send("Failed loading coupons");
  }
};



// Form page opens
// ✅ Load form + send categories to EJS so it doesn't crash
// export const getCreateCouponPage = async (req, res) => {
//   try {
//     const categories = await Category.find({}).lean(); // ✔ fetch categories from DB

//    res.render("admin/couponCreate", {
//   categories,
//   error: null,
//   success: null,
//   oldInput: {},
//   minOrderAmount:  minOrderAmount || 1,
//   minDiscount: 5,
//   maxDiscount: 90
// });

//   } catch (err) {
//     res.render("admin/couponCreate", {
//   categories: [],
//   error: "Failed to load categories",
//   success: null,
//   oldInput: {},
//   minOrderAmount:  minOrderAmount || 1,
//   minDiscount: 5,
//   maxDiscount: 90
// });

//   }
// };

export const getCreateCouponPage = async (req, res) => {
  try {
    // Generate default dates for the form
    const now = new Date();
    const defaultFrom = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    const defaultTo = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    res.render("admin/couponCreate", {
      error: null,
      success: null,
      oldInput: {},
      defaultFrom: defaultFrom.toISOString().slice(0, 16),
      defaultTo: defaultTo.toISOString().slice(0, 16),
      minOrderAmount: 1,
      minDiscount: 5,
      maxDiscount: 90
    });

  } catch (err) {
    res.render("admin/couponCreate", {
      error: ["Failed to load page"],
      success: null,
      oldInput: {},
      defaultFrom: "",
      defaultTo: "",
      minOrderAmount: 1,
      minDiscount: 5,
      maxDiscount: 90
    });
  }
};

export const createCoupon = async (req, res) => {
  try {
    let {
      code,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validFrom,
      validTo,
      maxUsage,
      maxUsagePerUser,
      isActive,
    } = req.body;

    const now = new Date();
    const errors = [];

    // Normalize and convert
    code = code?.trim().toUpperCase();
    discountValue = Number(discountValue);
    maxDiscountAmount = Number(maxDiscountAmount || 0);
    minOrderAmount = Number(minOrderAmount || 0);
    maxUsage = maxUsage ? Number(maxUsage) : null;
    maxUsagePerUser = maxUsagePerUser ? Number(maxUsagePerUser) : null;
    isActive = !!isActive;

    const validFromDate = validFrom ? new Date(validFrom) : null;
    const validToDate = validTo ? new Date(validTo) : null;

    // Required field checks
    if (!code || code.length < 3) errors.push("Coupon Code must be at least 3 characters!");
    if (isNaN(discountValue)) errors.push("Discount percentage is required!");
    if (isNaN(maxDiscountAmount)) errors.push("Maximum Discount Amount is required!");
    if (!validFromDate) errors.push("Valid From is required!");
    if (!validToDate) errors.push("Valid To is required!");

    // Discount range 5–90
    if (discountValue < 5 || discountValue > 90) {
      errors.push("Discount must be between 5–90%");
    }

    // maxDiscountAmount < minOrderAmount
    if (maxDiscountAmount >= minOrderAmount) {
      errors.push("Max Discount Amount must be LESS than Min Order Amount");
    }

    // maxUsagePerUser ≤ maxUsage
    if (maxUsage && maxUsagePerUser && maxUsagePerUser > maxUsage) {
      errors.push("Max usage per user cannot exceed total max usage");
    }

    // Date validations
    const GRACE_MINUTES = 1;
    const safeNow = new Date(now.getTime() - GRACE_MINUTES * 60 * 1000);
    
    if (validFromDate < safeNow) errors.push("Valid From cannot be in the past!");
    if (validToDate <= validFromDate) errors.push("Valid To must be later than Valid From!");
    if (validToDate <= safeNow) errors.push("Valid To must be in the future!");

    // Unique code check
    if (!errors.length) {
      const existing = await Coupon.findOne({ code });
      if (existing) errors.push(`Coupon "${code}" already exists!`);
    }

    // If errors → return page
    if (errors.length > 0) {
      return res.render("admin/couponCreate", {
        error: errors,
        success: null,
        oldInput: req.body,
        defaultFrom: validFrom || "",
        defaultTo: validTo || "",
        minOrderAmount: 1,
        minDiscount: 5,
        maxDiscount: 90
      });
    }

    // Save to DB
    await Coupon.create({
      code,
      discountType: "PERCENTAGE",
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validFrom: validFromDate,
      validTo: validToDate,
      expiryDate: validToDate,
      maxUsage,
      maxUsagePerUser,
      isActive,
    });

    return res.redirect("/admin/coupon");

  } catch (err) {
    console.error("Coupon creation error:", err);
    return res.render("admin/couponCreate", {
      error: ["Server error while saving coupon!"],
      success: null,
      oldInput: req.body,
      defaultFrom: "",
      defaultTo: "",
      minOrderAmount: 1,
      minDiscount: 5,
      maxDiscount: 90
    });
  }
};


export const getEditCouponPage = async (req, res) => {
  try {
    const id = req.params.id;
    const coupon = await Coupon.findById(id).lean();
    if (!coupon) return res.status(404).send("Coupon not found!");

    res.render("admin/couponEdit", { coupon });

  } catch (err) {
    console.error("🔥 EDIT PAGE LOAD ERROR:", err.message);
    res.status(500).send("Failed to load edit page");
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const now = new Date();

    let {
      code,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validFrom,
      validTo,
      maxUsage,
      maxUsagePerUser,
      isActive
    } = req.body;

    const errors = [];

    // Format fields
    code = code?.trim().toUpperCase();
    discountValue = Number(discountValue);
    maxDiscountAmount = Number(maxDiscountAmount);
    minOrderAmount = Number(minOrderAmount || 0);
    maxUsage = maxUsage ? Number(maxUsage) : null;
    maxUsagePerUser = maxUsagePerUser ? Number(maxUsagePerUser) : null;
    isActive = Boolean(isActive);

    const validFromDate = new Date(validFrom);
    const validToDate = new Date(validTo);
    const expiryDateObj = validToDate; // ✅ EXPIRY always same as validTo

    // ---- Date edge case rules ----

    if (!validFrom) 
      errors.push("Valid From is required!");

    if (!validTo) 
      errors.push("Valid To is required!");

    if (validFromDate < now)
      errors.push("Valid From cannot be in past!");

    if (validToDate <= now)
      errors.push("Valid To / Expiry must be in future!");

    if (validToDate <= validFromDate)
      errors.push("Valid To must be later than Valid From!");

    // Discount percentage limits
    if (isNaN(discountValue) || discountValue < 1 || discountValue > 100)
      errors.push("Discount % must be 1–100!");

    if (isNaN(maxDiscountAmount) || maxDiscountAmount < 1)
      errors.push("Max Discount must be at least ₹1!");

    // Unique coupon code check excluding the current one
    const existing = await Coupon.findOne({ code, _id: { $ne: id } });
    if (existing)
      errors.push(`Coupon "${code}" already exists!`);

    // ❌ If any error → block save
    if (errors.length > 0) {
      console.error("🔥 VALIDATION FAILED:", errors);
      return res.status(400).json({ success:false, message: errors });
    }

    // ✅ UPDATE to DB
    await Coupon.findByIdAndUpdate(id, {
      code,
      discountValue,
      maxDiscountAmount: maxDiscountAmount,
      minOrderAmount,
      validFrom: validFromDate,
      validTo: validToDate,
      expiryDate: expiryDateObj,
      maxUsage,
      maxUsagePerUser,
      isActive
    });

    console.log("✅ COUPON UPDATED IN DB ✅🔥");
    return res.json({ success:true, message:["Coupon updated successfully!"] });

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err.message);
    return res.status(500).json({ success:false, message:["Server error while updating coupon!"] });
  }
};


