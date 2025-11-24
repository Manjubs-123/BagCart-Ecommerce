import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import User from "../../models/userModel.js";


export const getShopPage = async (req, res) => {
  try {

    // If user not logged in, redirect to login
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    //  ADD THIS PART HERE (STEP 1)
    let userWishlistIds = [];

    if (req.session.user) {
      const user = await User.findById(req.session.user.id).select("wishlist");
      if (user) {
        userWishlistIds = user.wishlist.map(id => id.toString());
      }
    }
    //  END OF ADDED BLOCK
console.log("SESSION USER DATA:", req.session.user);


    // CATEGORY SELECTION FROM QUERY
    const selectedCategories = Array.isArray(req.query.category)
      ? req.query.category
      : req.query.category
        ? [req.query.category]
        : [];

    // --- BUILD FILTER ---
    const filter = { isDeleted: false, isActive: true };

    if (selectedCategories.length > 0) {
      filter.category = { $in: selectedCategories };
    }

    // ---- FETCH PRODUCTS ----
    const products = await Product.find(filter)
      .populate({
        path: "category",
        match: { isDeleted: false, isActive: true }
      })
      .sort({ createdAt: -1 })
      .lean();

    // CLEAN PRODUCTS (remove invalid category)
    const cleanedProducts = products.filter((p) => p.category);

    // ---- UNIQUE COLORS ----
    const colors = [
      ...new Set(
        cleanedProducts.flatMap((p) =>
          p.variants?.map(v => v.color?.trim()).filter(Boolean) || []
        )
      )
    ];

    // ---- FETCH CATEGORIES ----
    const categories = await Category.find({ isDeleted: false, isActive: true })
      .sort({ name: 1 })
      .lean();

    // PASS userWishlistIds TO SHOP PAGE (STEP 2)
    res.render("user/shop", {
      title: "Shop | BagHub",
      products: cleanedProducts,
      categories,
      selectedCategories,
      colors,
      userWishlistIds,     
      user: req.session.user || null,
    });

  } catch (error) {
    console.error("Error rendering shop page:", error);
    res.status(500).send("Failed to load shop page");
  }
};

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




