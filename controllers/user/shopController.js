
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import User from "../../models/userModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js";


export const getShopPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    const perPage = parseInt(req.query.perPage, 10) || 12;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const search = (req.query.search || "").trim();

let safeSearch = search;


if (!/[a-zA-Z0-9]/.test(safeSearch)) {
  safeSearch = "";
} else {
  
  safeSearch = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


    const categories = req.query.category
      ? Array.isArray(req.query.category) ? req.query.category : [req.query.category]
      : [];
    const colors = req.query.color
      ? Array.isArray(req.query.color) ? req.query.color : [req.query.color]
      : [];
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const brands = req.query.brand
      ? Array.isArray(req.query.brand) ? req.query.brand : [req.query.brand]
      : [];
    const sort = req.query.sort || "";

    const filter = { isDeleted: false, isActive: true };

    if (categories.length) filter.category = { $in: categories.map(id => id) };

   if (safeSearch) {
  filter.$or = [
    { name: { $regex: safeSearch, $options: "i" } },
    { description: { $regex: safeSearch, $options: "i" } },
    { brand: { $regex: safeSearch, $options: "i" } },
  ];
}


    if (colors.length) {
      filter["variants.color"] = { $in: colors };
    }

    if (brands.length) {
      filter.brand = { $in: brands };
    }

   
    if (minPrice != null || maxPrice != null) {
      const priceFilter = {};
      if (minPrice != null) priceFilter.$gte = minPrice;
      if (maxPrice != null) priceFilter.$lte = maxPrice;
      filter["variants.price"] = priceFilter;
    }

    
    const totalCount = await Product.countDocuments(filter);

    let sortObj = { createdAt: -1 }; 
    switch (sort) {
      case "price-low":
        sortObj = { "variants.0.price": 1 };
        break;
      case "price-high":
        sortObj = { "variants.0.price": -1 };
        break;
      case "name-asc":
        sortObj = { name: 1 };
        break;
      case "name-desc":
        sortObj = { name: -1 };
        break;
      case "new":
        sortObj = { createdAt: -1 };
        break;
      default:
        break;
    }

    
    const products = await Product.find(filter)
      .populate({ path: "category", match: { isDeleted: false, isActive: true } })
      .sort(sortObj)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    
    const cleanedProducts = products.filter(p => p.category);

    const productsWithOffers = await Promise.all(
      cleanedProducts.map(async (product) => {
        const offerData = await applyOfferToProduct(product);
        

        const firstVariant = product.variants?.[0] || {};
        
       
        let mainImage = '/images/placeholder.jpg';
        if (firstVariant.images && firstVariant.images.length > 0) {
          mainImage = firstVariant.images[0].url;
        } else {
         
          const variantWithImage = product.variants?.find(v => v.images && v.images.length > 0);
          if (variantWithImage) {
            mainImage = variantWithImage.images[0].url;
          }
        }
        
const defaultVariantOffer =
  offerData.variants && offerData.variants[0]
    ? offerData.variants[0]
    : {
        regularPrice: firstVariant.mrp || firstVariant.price || 0,
        finalPrice: firstVariant.price || 0,
        appliedOffer: null
      };

return {
  ...product,

  regularPrice: defaultVariantOffer.regularPrice,
  finalPrice: defaultVariantOffer.finalPrice,
  appliedOffer: defaultVariantOffer.appliedOffer,

  variantPrice: firstVariant.price || 0,
  variantMRP: firstVariant.mrp || firstVariant.price || 0,

  mainImage: mainImage,

  discountPercent:
    defaultVariantOffer.regularPrice > defaultVariantOffer.finalPrice
      ? Math.round(
          ((defaultVariantOffer.regularPrice - defaultVariantOffer.finalPrice) /
            defaultVariantOffer.regularPrice) * 100
        )
      : 0
};

       
      })
    );

    const allProductsForFilters = await Product.find({ isDeleted: false, isActive: true }).lean();

    const colorsList = [...new Set(allProductsForFilters.flatMap(p => p.variants?.map(v => v.color?.trim()).filter(Boolean) || []))];
    const brandsList = [...new Set(allProductsForFilters.map(p => p.brand).filter(Boolean))];

    const categoriesList = await Category.find({ isDeleted: false, isActive: true }).sort({ name: 1 }).lean();

    let userWishlistIds = [];
    if (req.session.user) {
      const u = await User.findById(req.session.user.id).select("wishlist");
      if (u) userWishlistIds = u.wishlist.map(i => i.toString());
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

    const currentQuery = {
      search,
      category: categories,
      color: colors,
      brand: brands,
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      sort,
      page,
      perPage
    };

    
    const buildPaginationUrl = (pageNum) => {
      const params = new URLSearchParams();
      
      
      if (search) params.set('search', search);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (sort) params.set('sort', sort);
      
      categories.forEach(cat => params.append('category', cat));
      colors.forEach(color => params.append('color', color));
      brands.forEach(brand => params.append('brand', brand));
      
      params.set('page', pageNum);
      return params.toString();
    };

    res.render("user/shop", {
      title: "Shop | BagHub",
      products: productsWithOffers, 
      categories: categoriesList,
      colors: colorsList,
      brands: brandsList,
      userWishlistIds,
      user: req.session.user || null,
      pagination: {
        page,
        perPage,
        totalCount,
        totalPages
      },
      currentQuery,
      selectedCategories: categories,
      buildPaginationUrl
    });
  } catch (err) {
    console.error("Error rendering shop page:", err);
    res.status(500).send("Failed to load shop page");
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId)
      .populate("category", "_id name")
      .lean();

    if (!product || product.isDeleted || product.isBlocked === true) {
      return res.redirect("/shop");
    }

    
    const offerData = await applyOfferToProduct(product);
    
    const firstVariant = (product.variants || [])[0] || {};

    const variantImages = {};
    (product.variants || []).forEach(v => {
      if (v.color && v.images?.length) {
        variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
      }
    });

    const allProductImages = variantImages[Object.keys(variantImages)[0]] || [];

    
    const defaultVariantOffer =
      offerData && Array.isArray(offerData.variants) && offerData.variants[0]
        ? offerData.variants[0]
        : {
            regularPrice: firstVariant.mrp || firstVariant.price || 0,
            finalPrice: firstVariant.price || 0,
            appliedOffer: null
          };

    const viewProduct = {
      _id: product._id,
      productName: product.name,
      
      salePrice: defaultVariantOffer.finalPrice,      // Final discounted price
      regularPrice: defaultVariantOffer.regularPrice, // Original price to be crossed
    
      variantPrice: firstVariant.price || 0,
      variantMRP: firstVariant.mrp || firstVariant.price || 0,
      
      appliedOffer: defaultVariantOffer.appliedOffer,
      
      description: product.description || "",
      productFeatures: product.productFeatures || [],
      colors: (product.variants || []).map(v => v.color).filter(Boolean),
      stock: firstVariant.stock || 0,
      sku: product.sku || String(product._id),
      rating: product.rating || 4.5,
      reviews: product.reviewsCount || 0,
      category: product.category,
      brand: product.brand || "BagHub",
      discountPercent: defaultVariantOffer.regularPrice > defaultVariantOffer.finalPrice 
        ? Math.round(((defaultVariantOffer.regularPrice - defaultVariantOffer.finalPrice) / defaultVariantOffer.regularPrice) * 100)
        : 0
    };

    
    let relatedProducts = [];

    if (product.category?._id) {
      relatedProducts = await Product.find({
        category: product.category._id,
        _id: { $ne: product._id },
        isDeleted: false,
        isActive: true,
      })
        .populate("category", "name")
        .limit(8)
        .lean();
    }

    if (!relatedProducts.length && product.brand) {
      relatedProducts = await Product.find({
        brand: product.brand,
        _id: { $ne: product._id },
        isDeleted: false,
        isActive: true,
      })
        .populate("category", "name")
        .limit(8)
        .lean();
    }

    if (!relatedProducts.length) {
      relatedProducts = await Product.aggregate([
        { $match: { _id: { $ne: product._id }, isDeleted: false, isActive: true } },
        { $sample: { size: 8 } },
      ]);
    }

    const formattedRelated = await Promise.all(
      relatedProducts.map(async (p) => {
        const relatedOfferData = await applyOfferToProduct(p);
        const fv = (p.variants || [])[0] || {};
        const firstImage = (p.variants || [])
          .flatMap(v => (v.images || []).map(img => typeof img === "string" ? img : img.url))
          .filter(Boolean)[0] || "/default-product.jpg";

        const relatedDefaultOffer =
          relatedOfferData && Array.isArray(relatedOfferData.variants) && relatedOfferData.variants[0]
            ? relatedOfferData.variants[0]
            : {
                regularPrice: fv.mrp || fv.price || 0,
                finalPrice: fv.price || 0,
                appliedOffer: null
              };

        return {
          _id: p._id,
          name: p.name || "Untitled Product",
          brand: p.brand || "BagHub",
          salePrice: relatedDefaultOffer.finalPrice,
          regularPrice: relatedDefaultOffer.regularPrice,
          appliedOffer: relatedDefaultOffer.appliedOffer,
          productImage: [firstImage],
          rating: p.rating || 4.5,
          categoryName: p.category?.name || "Other",
          discountPercent: relatedDefaultOffer.regularPrice > relatedDefaultOffer.finalPrice 
            ? Math.round(((relatedDefaultOffer.regularPrice - relatedDefaultOffer.finalPrice) / relatedDefaultOffer.regularPrice) * 100)
            : 0
        };
      })
    );

    let userWishlist = [];
    if (req.session.user && req.session.user.id) {
      const usr = await User.findById(req.session.user.id).select("wishlist");
      if (usr && usr.wishlist) {
        userWishlist = usr.wishlist.map(id => id.toString());
      }
    }

    res.render("user/productDetails", {
      title: `${viewProduct.productName} - BagHub`,
      product: viewProduct,
      allProductImages,
      relatedProducts: formattedRelated,
      categoryName: product.category?.name || "Other",
      user: req.session?.user || { wishlistCount: 0 },
      userWishlist,
      variantImages,
      colorMap: {
        black: "#000000",
        blue: "#1e40af",
        red: "#dc2626",
        green: "#059669",
        gray: "#6b7280",
        brown: "#92400e",
        white: "#ffffff",
        yellow: "#facc15",
        pink: "#ec4899",
        purple: "#8b5cf6",
        orange: "#f97316",
      },
    });
  } catch (error) {
    console.error("Error loading product details:", error);
    res.redirect("/shop");
  }
};

export const getVariantByColor = async (req, res) => {
  try {
    const { productId } = req.params;
    const { color } = req.query;

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    const variantIndex = product.variants.findIndex(
      v => v.color && color && v.color.toLowerCase() === color.toLowerCase()
    );

    if (variantIndex === -1) {
      return res.json({ success: false, message: "Variant not found" });
    }

    const variant = product.variants[variantIndex];

    const variantProduct = {
      ...product,
      variants: [variant]
    };

    const offerData = await applyOfferToProduct(variantProduct);

    const variantOffer =
      offerData && Array.isArray(offerData.variants) && offerData.variants[0]
        ? offerData.variants[0]
        : {
            regularPrice: variant.mrp || variant.price || 0,
            finalPrice: variant.price || 0,
            appliedOffer: null
          };

    const images =
      Array.isArray(variant.images) && variant.images.length
        ? variant.images.map(img => (typeof img === "string" ? img : img.url)).filter(Boolean)
        : [];

    return res.json({
      success: true,
      variantIndex,
      variant: {
        color: variant.color,
        price: Number(variant.price) || 0,
        mrp: Number(variant.mrp) || Number(variant.price) || 0,
        stock: variant.stock || 0,
        images
      },
      offerData: {
        regularPrice: Number(variantOffer.regularPrice) || 0,
        finalPrice: Number(variantOffer.finalPrice) || 0,
        appliedOffer: variantOffer.appliedOffer || null
      }
    });

  } catch (error) {
    console.error("Error in getVariantByColor:", error);
    return res.json({ success: false, message: "Server error" });
  }
};
