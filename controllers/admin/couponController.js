import Coupon from "../../models/couponModel.js";

 const escapeRegex = (text = "") =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getCouponListPage = async (req, res) => {
  try {
    const { q = "", status = "", type = "", sort = "", page = 1, limit = 10 } = req.query;
    const now = new Date();

    const safeQ = escapeRegex(q.trim());

    let query = {};

    if (q.trim()) {
      query.code = { $regex: safeQ, $options: "i" };
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

    const totalCoupons = await Coupon.countDocuments(query);

    const coupons = await Coupon.find(query)
      .sort(sortQuery)
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const totalUsageAgg = await Coupon.aggregate([
      { $group: { _id: null, total: { $sum: "$usedCount" } } }
    ]);

    res.render("admin/couponList", {
      coupons,
      totalCoupons,
      activeCoupons: await Coupon.countDocuments({ isActive: true }),
      expiredCoupons: await Coupon.countDocuments({ expiryDate: { $lt: now } }),
      totalUsage: totalUsageAgg[0]?.total || 0,
      q,
      statusFilter: status,
      typeFilter: type,
      sort,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(totalCoupons / Number(limit))
    });

  } catch (err) {
    console.error("LIST PAGE ERROR:", err.message);
    res.status(500).send("Failed loading coupons");
  }
};


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

    // If errors exist
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
    console.error("EDIT PAGE LOAD ERROR:", err.message);
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

    console.log(" UPDATE PAYLOAD:", req.body); 

    const errors = [];

    // Normalize and convert
    code = code?.trim().toUpperCase();
    discountValue = Number(discountValue);
    maxDiscountAmount = Number(maxDiscountAmount);
    minOrderAmount = Number(minOrderAmount || 0);
    maxUsage = maxUsage ? Number(maxUsage) : null;
    maxUsagePerUser = maxUsagePerUser ? Number(maxUsagePerUser) : null;
    isActive = Boolean(isActive);

    const validFromDate = new Date(validFrom);
    const validToDate = new Date(validTo);

    console.log(" DATES - From:", validFromDate, "To:", validToDate); 

  
    if (!code || code.length < 3) errors.push("Coupon Code must be at least 3 characters!");
    if (isNaN(discountValue)) errors.push("Discount percentage is required!");
    if (isNaN(maxDiscountAmount)) errors.push("Maximum Discount Amount is required!");
    if (!validFrom) errors.push("Valid From is required!");
    if (!validTo) errors.push("Valid To is required!");

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

    // Unique coupon code check excluding the current one
    if (errors.length === 0) {
      const existing = await Coupon.findOne({ code, _id: { $ne: id } });
      if (existing) errors.push(`Coupon "${code}" already exists!`);
    }

    //  If any error  block save
    if (errors.length > 0) {
      console.error(" VALIDATION FAILED:", errors);
      return res.status(400).json({ success: false, message: errors });
    }

    //  UPDATE to DB
    const updateData = {
      code,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validFrom: validFromDate,
      validTo: validToDate,
      expiryDate: validToDate,
      maxUsage: maxUsage || null,
      maxUsagePerUser: maxUsagePerUser || null,
      isActive
    };

    console.log(" SAVING TO DB:", updateData); 

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id, 
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: ["Coupon not found!"] });
    }

    console.log(" COUPON UPDATED IN DB:", updatedCoupon);
    return res.json({ success: true, message: ["Coupon updated successfully!"] });

  } catch (err) {
    console.error(" SERVER ERROR:", err.message);
    return res.status(500).json({ success: false, message: ["Server error while updating coupon!"] });
  }
};

export const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found!" });
    }

    //  Toggle active / inactive
    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.json({
      success: true,
      message: `Coupon ${coupon.code} is now ${coupon.isActive ? "Active " : "Inactive "}`,
      isActive: coupon.isActive
    });

  } catch (err) {
    console.error(" TOGGLE COUPON ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error while toggling coupon" });
  }
};
