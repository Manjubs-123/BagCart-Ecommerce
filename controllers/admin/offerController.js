import Coupon from "../../models/couponModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import Offer from "../../models/offerModel.js";



async function validateOfferName(name, excludeId = null) {
  const lower = name.trim().toLowerCase();

  const offerQuery = { name: { $regex: `^${lower}$`, $options: "i" } };
  if (excludeId) offerQuery._id = { $ne: excludeId };

  const offerExist = await Offer.findOne(offerQuery);
  if (offerExist) return "Offer name already exists";

  // C..A coupons
  const couponExist = await Coupon.findOne({
    code: { $regex: `^${lower}$`, $options: "i" }
  });
  if (couponExist) return "Offer name cannot match a coupon code";

  // C..A product names
  const productExist = await Product.findOne({
    name: { $regex: `^${lower}$`, $options: "i" }
  });
  if (productExist) return "Offer name cannot match a product name";

  // C..A category names
  const categoryExist = await Category.findOne({
    name: { $regex: `^${lower}$`, $options: "i" }
  });
  if (categoryExist) return "Offer name cannot match a category name";

  return null; 
}



export const getOffers = async (req, res) => {
  try {
    let { type, status, search, page = 1 } = req.query;

    const currentPage = Number(page) || 1;
    const limit = 10;
    const skip = (currentPage - 1) * limit;

    let filter = {};

    
    if (type) filter.type = type;

    
    if (search && search.trim() !== "") {
      filter.$or = [
        { name: { $regex: search, $options: "i" } }
      ];
    }

    const now = new Date();

    
    if (status === "active") {
      filter.isActive = true;
      filter.validTo = { $gte: now };
    } 
    else if (status === "expired") {
      filter.validTo = { $lt: now };
    }

    const totalOffers = await Offer.countDocuments(filter);


    const offers = await Offer.find(filter)
      .populate("products", "name price image")
      .populate("categories", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const stats = {
      totalOffers: await Offer.countDocuments(),
      activeOffers: await Offer.countDocuments({
        isActive: true,
        validTo: { $gte: now }
      }),
      productOffers: await Offer.countDocuments({ type: "product" }),
      categoryOffers: await Offer.countDocuments({ type: "category" })
    };

    return res.render("admin/offerList", {
      offers,
      stats,
      page: currentPage,
      totalPages: Math.max(1, Math.ceil(totalOffers / limit)),
      currentType: type || "",
      currentStatus: status || "",
      search: search || ""   
    });

  } catch (error) {
    console.error("Get offers error:", error);

    return res.status(500).render("admin/offerList", {
      offers: [],
      stats: { totalOffers: 0, activeOffers: 0, productOffers: 0, categoryOffers: 0 },
      page: 1,
      totalPages: 1,
      currentType: "",
      currentStatus: "",
      search: ""
    });
  }
};


export const getCreateOfferPage = async (req, res) => {
  try {

    return res.render("admin/createOffer", {
      isEdit: false,
      offer: null,
      currentStep: 1
      
    });
  } catch (err) {
    console.error("Create offer page error:", err);
    return res.status(500).send("Server error");
  }
};

export const getActiveProducts = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const activeFilter = {
      $or: [
        { isActive: true },
        { isListed: true },
        { isAvailable: true },
        { status: "active" }
      ]
    };

    const searchFilter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { brand: { $regex: search, $options: "i" } },
            { "category.name": { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const finalFilter = Object.keys(searchFilter).length ? { $and: [activeFilter, searchFilter] } : activeFilter;

    const products = await Product.find(finalFilter)
      .select("name price image")
      .limit(200)
      .lean();

    return res.json({ success: true, products });
  } catch (err) {
    console.error("getActiveProducts error:", err);
    return res.status(500).json({ success: false, message: "Server error loading products" });
  }
};

export const getActiveCategories = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const activeFilter = {
      $or: [
        { isActive: true },
        { isListed: true },
        { status: "active" }
      ]
    };

    const searchFilter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const finalFilter = Object.keys(searchFilter).length ? { $and: [activeFilter, searchFilter] } : activeFilter;

    const categories = await Category.find(finalFilter)
      .select("name")
      .limit(200)
      .lean();

    return res.json({ success: true, categories });
  } catch (err) {
    console.error("getActiveCategories error:", err);
    return res.status(500).json({ success: false, message: "Server error loading categories" });
  }
};


export const postCreateOffer = async (req, res) => {
  try {
    console.log("Incoming BODY:", req.body);

    let {
      type,
      name,
      discountValue,
      validFrom,
      validTo,
      products,
      categories,
      isActive
    } = req.body;

 
    if (!type || !name || !discountValue || !validFrom || !validTo) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (!["product", "category"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer type"
      });
    }

    const discount = Number(discountValue);
    if (discount < 5 || discount > 90) {
      return res.status(400).json({
        success: false,
        message: "Discount must be between 5% and 90%"
      });
    }

    const start = new Date(validFrom);
    const end = new Date(validTo);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format"
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

  
    const normalizedName = name.trim().toLowerCase();

    const existingOffer = await Offer.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "An offer with this name already exists. Please use a different name."
      });
    }

    const existingCoupon = await Coupon.findOne({
      code: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "This offer name matches an existing coupon code. Use a unique name."
      });
    }

   
   
    let productIds = [];
    let categoryIds = [];

    if (type === "product") {
      if (!products) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one product"
        });
      }
      productIds = products.split(",").filter(id => id.trim() !== "");
    }

    if (type === "category") {
      if (!categories) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one category"
        });
      }
      categoryIds = categories.split(",").filter(id => id.trim() !== "");
    }

   

    const newOffer = new Offer({
      name,
      type,
      discountValue: discount,
      validFrom: start,
      validTo: end,
      isActive: isActive ? true : false,
      products: productIds,
      categories: categoryIds
    });

    await newOffer.save();

    return res.status(200).json({
      success: true,
      message: "Offer created successfully"
    });

  } catch (err) {
    console.error("Create offer error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while creating offer"
    });
  }
};



export const toggleOfferStatus = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { isActive } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    offer.isActive = isActive;
    await offer.save();

    return res.json({
      success: true,
      message: `Offer ${isActive ? "activated" : "deactivated"} successfully`
    });

  } catch (error) {
    console.error("Toggle status error:", error);
    return res.status(500).json({ success: false, message: "Server error updating status" });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    await Offer.findByIdAndDelete(offerId);

    return res.json({
      success: true,
      message: "Offer deleted successfully"
    });

  } catch (err) {
    console.error("Delete Offer Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error deleting offer"
    });
  }
};



export const getEditOfferPage = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId)
      .populate("products", "name price image")
      .populate("categories", "name")
      .lean();

    if (!offer) {
      return res.status(404).send("Offer not found");
    }

    return res.render("admin/editOffer", {
      isEdit: true,
      offer,
      currentStep: 1
    });
  } catch (err) {
    console.error("Get edit offer page error:", err);
    return res.status(500).send("Server error");
  }
};


export const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    let {
      type,
      name,
      discountValue,
      validFrom,
      validTo,
      products,
      categories,
      isActive
    } = req.body;

   
    if (!type || !name || !discountValue || !validFrom || !validTo) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!["product", "category"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid offer type" });
    }

    const discount = Number(discountValue);
    if (isNaN(discount) || discount < 5 || discount > 90) {
      return res.status(400).json({ success: false, message: "Discount must be between 5% and 90%" });
    }

    const start = new Date(validFrom);
    const end = new Date(validTo);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }
    if (end <= start) {
      return res.status(400).json({ success: false, message: "End date must be after start date" });
    }
    
  
    const normalizedName = name.trim().toLowerCase();

    const existingOffer = await Offer.findOne({
      _id: { $ne: offerId }, 
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "Another offer already exists with this name. Please choose a different name."
      });
    }

    const existingCoupon = await Coupon.findOne({
      code: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "This name already exists as a coupon code. Offer name must be unique."
      });
    }

    let productIds = [];
    let categoryIds = [];

    if (type === "product") {
      if (!products) return res.status(400).json({ success: false, message: "Please select at least one product" });
      productIds = Array.isArray(products) ? products : String(products).split(",").map(s => s.trim()).filter(Boolean);
    } else {
      if (!categories) return res.status(400).json({ success: false, message: "Please select at least one category" });
      categoryIds = Array.isArray(categories) ? categories : String(categories).split(",").map(s => s.trim()).filter(Boolean);
    }

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    offer.name = name;
    offer.type = type;
    offer.discountValue = discount;
    offer.validFrom = start;
    offer.validTo = end;
    offer.isActive = isActive === true || isActive === "true" || isActive === "on";

    offer.products = type === "product" ? productIds : [];
    offer.categories = type === "category" ? categoryIds : [];

    await offer.save();

    return res.json({ success: true, message: "Offer updated successfully" });

  } catch (err) {
    console.error("Update offer error:", err);
    return res.status(500).json({ success: false, message: "Server error while updating offer" });
  }
};


