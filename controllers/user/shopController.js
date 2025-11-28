
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import User from "../../models/userModel.js";

export const getShopPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    // Pagination params
    const perPage = parseInt(req.query.perPage, 10) || 12;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    // Filters from query string
    const search = (req.query.search || "").trim();
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

    // Build filter - KEEP YOUR ORIGINAL WORKING FILTER
    const filter = { isDeleted: false, isActive: true };

    if (categories.length) filter.category = { $in: categories.map(id => id) };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    if (colors.length) {
      filter["variants.color"] = { $in: colors };
    }

    if (brands.length) {
      filter.brand = { $in: brands };
    }

    // Price filter - KEEP YOUR ORIGINAL WORKING LOGIC
    if (minPrice != null || maxPrice != null) {
      const priceFilter = {};
      if (minPrice != null) priceFilter.$gte = minPrice;
      if (maxPrice != null) priceFilter.$lte = maxPrice;
      filter["variants.price"] = priceFilter;
    }

    // Count total matching
    const totalCount = await Product.countDocuments(filter);

    // Sorting - FIXED: Use proper MongoDB sort syntax
    let sortObj = { createdAt: -1 }; // default (newest first)
    switch (sort) {
      case "price-low":
        sortObj = { "variants.0.price": 1 }; // Use first variant price for low to high
        break;
      case "price-high":
        sortObj = { "variants.0.price": -1 }; // Use first variant price for high to low
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

    // Fetch products (with pagination) - YOUR ORIGINAL WORKING QUERY
    const products = await Product.find(filter)
      .populate({ path: "category", match: { isDeleted: false, isActive: true } })
      .sort(sortObj)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    // Remove products with invalid category
    const cleanedProducts = products.filter(p => p.category);

    // Unique colors and brands for sidebar UI - YOUR ORIGINAL WORKING LOGIC
    const allProductsForFilters = await Product.find({ isDeleted: false, isActive: true }).lean();

    const colorsList = [...new Set(allProductsForFilters.flatMap(p => p.variants?.map(v => v.color?.trim()).filter(Boolean) || []))];
    const brandsList = [...new Set(allProductsForFilters.map(p => p.brand).filter(Boolean))];

    // categories for sidebar
    const categoriesList = await Category.find({ isDeleted: false, isActive: true }).sort({ name: 1 }).lean();

    // wishlist ids for current user
    let userWishlistIds = [];
    if (req.session.user) {
      const u = await User.findById(req.session.user.id).select("wishlist");
      if (u) userWishlistIds = u.wishlist.map(i => i.toString());
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

    // Pass the current query back so we can preserve inputs in the form
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

    // FIXED: Add pagination URL builder to preserve filters
    const buildPaginationUrl = (pageNum) => {
      const params = new URLSearchParams();
      
      // Preserve all filters
      if (search) params.set('search', search);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (sort) params.set('sort', sort);
      
      // Preserve array filters
      categories.forEach(cat => params.append('category', cat));
      colors.forEach(color => params.append('color', color));
      brands.forEach(brand => params.append('brand', brand));
      
      params.set('page', pageNum);
      return params.toString();
    };

    res.render("user/shop", {
      title: "Shop | BagHub",
      products: cleanedProducts,
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
      buildPaginationUrl // ADD THIS for proper pagination
    });
  } catch (err) {
    console.error("Error rendering shop page:", err);
    res.status(500).send("Failed to load shop page");
  }
};

// KEEP YOUR ORIGINAL WORKING FUNCTIONS - DON'T CHANGE THEM
export const filterProducts = async (req, res) => {
  try {
    const { search, categories, colors, minPrice, maxPrice, sort } = req.body;

    const filter = { isDeleted: false, isActive: true };

    if (categories?.length) filter.category = { $in: categories };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by variant color
    if (colors?.length) {
      filter["variants.color"] = { $in: colors };
    }

    // Price filter via variant price range
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = parseFloat(minPrice);
    if (maxPrice) priceFilter.$lte = parseFloat(maxPrice);
    if (Object.keys(priceFilter).length) {
      filter["variants.price"] = priceFilter;
    }

    let products = await Product.find(filter)
      .populate("category")
      .lean();

    
    if (sort) {
      switch (sort) {
        case "price-low":
          products.sort((a, b) => (a.variants?.[0]?.price || 0) - (b.variants?.[0]?.price || 0));
          break;
        case "price-high":
          products.sort((a, b) => (b.variants?.[0]?.price || 0) - (a.variants?.[0]?.price || 0));
          break;
        case "name-asc":
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "name-desc":
          products.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case "new":
          products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
      }
    }

    res.json({ success: true, products, count: products.length });
  } catch (error) {
    console.error("Error filtering products:", error);
    res.status(500).json({ success: false, message: "Error filtering products" });
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    // Fetch product with category populated
    const product = await Product.findById(productId)
      .populate("category", "_id name")
      .lean();

    if (!product || product.isDeleted || product.isBlocked === true) {
      return res.redirect("/shop");
    }

    // Prepare variant images grouped by color
    const variantImages = {};
    (product.variants || []).forEach(v => {
      if (v.color && v.images?.length) {
        variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
      }
    });

    const firstVariant = (product.variants || [])[0] || {};
    const allProductImages =
      variantImages[Object.keys(variantImages)[0]] || [];

    // Main Product object for EJS
    const viewProduct = {
      _id: product._id,
      productName: product.name,
      salePrice: firstVariant.price || 0,
      regularPrice: firstVariant.mrp || null,
      description: product.description || "",
      productFeatures: product.productFeatures || [],
      colors: (product.variants || []).map(v => v.color).filter(Boolean),
      stock: firstVariant.stock || 0,
      sku: product.sku || String(product._id),
      rating: product.rating || 4.5,
      reviews: product.reviewsCount || 0,
      category: product.category,
      brand: product.brand || "BagHub",
    };

    
        
    let relatedProducts = [];

    //  Related by Category
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

      if (relatedProducts.length > 0)
        console.log(` Found ${relatedProducts.length} related products by category`);
    }

    //  Related by Brand
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

      if (relatedProducts.length > 0)
        console.log(` Found ${relatedProducts.length} related products by brand`);
    }

    //  Random products
    if (!relatedProducts.length) {
      relatedProducts = await Product.aggregate([
        { $match: { _id: { $ne: product._id }, isDeleted: false, isActive: true } },
        { $sample: { size: 8 } }, 
      ]);

      console.log(`Used random fallback. Found: ${relatedProducts.length}`);
    }

const formattedRelated = relatedProducts.map(p => {
  const fv = (p.variants || [])[0] || {};
  const firstImage =
    (p.variants || [])
      .flatMap(v =>
        (v.images || []).map(img =>
          typeof img === "string" ? img : img.url
        )
      )
      .filter(Boolean)[0] || "/default-product.jpg";

  return {
    _id: p._id,
    name: p.name || "Untitled Product",
    brand: p.brand || "BagHub",
    salePrice: fv.price || 0,
    regularPrice: fv.mrp || null,
    productImage: [firstImage],
    rating: p.rating || 4.5,
    categoryName: p.category?.name || "Other",
  };
});

//  FETCH USER WISHLIST IDS
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
    console.error(" Error loading product details:", error);
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
      v => v.color.toLowerCase() === color.toLowerCase()
    );

    if (variantIndex === -1) {
      return res.json({ success: false, message: "Variant not found" });
    }

    const variant = product.variants[variantIndex];

    return res.json({
      success: true,
      variantIndex,     
      variant: {
        color: variant.color,
        price: variant.price,
        mrp: variant.mrp,
        stock: variant.stock,
        images: variant.images.map(img => img.url)
      }
    });

  } catch (error) {
    return res.json({ success: false, message: "Server error" });
  }
};