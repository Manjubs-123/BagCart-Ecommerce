import Product from "../../models/productModel.js";
import Category from "../../models/category.js";

export const getShopPage = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 12, category: categoryFilter } = req.query;

    //  Fetch only active categories
    const categories = await Category.find({
      isDeleted: false,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    //  Build base filter
    const filter = { isDeleted: false, isActive: true };

    // Search filter (by product name, brand, description)
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { brand: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Category filter
    if (categoryFilter) {
      const catArray = Array.isArray(categoryFilter)
        ? categoryFilter
        : [categoryFilter];
      filter.category = { $in: catArray };
    }

    // Pagination setup
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    //  Fetch products and populate category
    let products = await Product.find(filter)
      .populate({
        path: "category",
        match: { isDeleted: false, isActive: true },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Remove products without valid category
    products = products.filter((p) => p.category);

     // DEBUG: check if Cloudinary image URLs are stored correctly
    console.log("Products fetched for user side:", products[0]?.variants?.[0]?.images);

    //  Extract unique colors from variants
    const allColors = [
      ...new Set(
        products.flatMap((p) =>
          Array.isArray(p.variants)
            ? p.variants
                .map((v) => v.color?.trim())
                .filter(Boolean)
            : []
        )
      ),
    ];

    //  Pagination totals
    const totalCount = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    //  Pass selected categories for UI highlight
    const selectedCategories = Array.isArray(req.query.category)
      ? req.query.category.map(String)
      : req.query.category
      ? [String(req.query.category)]
      : [];

    // Render EJS with all required data
    res.render("user/shop", {
      title: "Shop - BagHub",
      products,
      categories,
      colors: allColors,
      allColors,
      search,
      page: pageNum,
      totalPages,
      totalCount,
      selectedCategories,
      user: req.session?.user || null,
    });
  } catch (err) {
    console.error("Error loading shop page:", err);
    res
      .status(500)
      .render("user/error", { message: "Failed to load shop", error: err.message });
  }
};

// Filter Products (AJAX)
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

    //  Sort
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


// export const getProductDetails = async (req, res) => {
//  try {
//     const productId = req.params.id;

//     const product = await Product.findById(productId)
//       .populate("category")
//       .lean();

//     if (!product || product.isBlocked) {
//       return res.redirect("/shop");
//     }

//     const relatedProducts = await Product.find({
//       category: product.category._id,
//       _id: { $ne: productId },
//       isBlocked: false,
//     })
//       .limit(4)
//       .lean();

//     res.render("user/productDetails", {
//       title: product.name,
//       product,
//       relatedProducts,
//     });
//   } catch (error) {
//     console.error("❌ Product detail page error:", error);
//     res.redirect("/shop");
//   }
// };

// export const getProductDetails = async (req, res) => {
//   try {
//     const productId = req.params.id;

//     const product = await Product.findById(productId)
//       .populate("category")
//       .lean();

//     if (!product || product.isBlocked) {
//       return res.redirect("/shop");
//     }

//     //  collect all variant images into a single array
//     const allProductImages = product.variants
//       ? product.variants.flatMap(v =>
//           v.images.map(img => img.url)
//         )
//       : [];

//     //  fetch related products (same category)
//     const relatedProducts = await Product.find({
//       category: product.category._id,
//       _id: { $ne: productId },
//       isBlocked: false,
//     })
//       .limit(4)
//       .lean();
//     //  render page with all data
//    res.render("user/productDetails", {
//   title: product.name,
//   product,
//   allProductImages: product.images,
//   relatedProducts, // add this line
// });
//   } catch (error) {
//     console.error("Product detail page error:", error);
//     res.redirect("/shop");
//   }
// };


// export const getProductDetails = async (req, res) => {
//   try {
//     console.log("✅ Product route hit:", req.params.id);
//     const productId = req.params.id;

//     // find product and populate its category
//     const product = await Product.findById(productId)
//       .populate("category", "name")
//       .lean();

//     if (!product || product.isBlocked) {
//       return res.redirect("/user/shop");
//     }

//     // ✅ collect all variant images
//     const allProductImages = (product.variants || [])
//       .flatMap((v) => (v.images || []).map((img) => img.url))
//       .filter(Boolean);

//     // ✅ pick first variant as default
//     const firstVariant = (product.variants || [])[0] || {};

//     // ✅ build data model that matches your EJS
//     const viewProduct = {
//       _id: product._id,
//       productName: product.name,
//       salePrice: firstVariant.price || 0,
//       regularPrice: firstVariant.mrp || null,
//       description: product.description || "",
//       productFeatures: product.productFeatures || [],
//       colors: (product.variants || []).map((v) => v.color).filter(Boolean),
//       stock: firstVariant.stock || 0,
//       sku: product.sku || String(product._id),
//       rating: product.rating || 4.5,
//       reviews: product.reviewsCount || 0,
//       category: product.category,
//     };

//     // ✅ fetch related products (same category)
//     const relatedProducts = await Product.find({
//       category: product.category?._id,
//       _id: { $ne: product._id },
//       isBlocked: false,
//       isDeleted: false,
//     })
//       .limit(4)
//       .lean();

//     // ✅ format related products for your EJS
//     const formattedRelated = relatedProducts.map((p) => {
//       const fv = (p.variants || [])[0] || {};
//       const firstImage =
//         (p.variants || [])
//           .flatMap((v) => (v.images || []).map((img) => img.url))
//           .filter(Boolean)[0] || "/images/placeholder.jpg";

//       return {
//         _id: p._id,
//         productName: p.name,
//         salePrice: fv.price || 0,
//         regularPrice: fv.mrp || null,
//         productImage: [firstImage],
//       };
//     });

//     // ✅ render your EJS
//     res.render("user/productDetails", {
//       title: `${viewProduct.productName} - BagHub`,
//       product: viewProduct,
//       allProductImages,
//       relatedProducts: formattedRelated,
//       user: req.session?.user || null,
//     });
//   } catch (error) {
//     console.error("❌ Product detail page error:", error);
//     res.redirect("/user/shop");
//   }
// };

// export const getProductDetails = async (req, res) => {
//   try {
//     console.log("✅ Product route hit:", req.params.id);
//     const productId = req.params.id;

//     // Fetch product with category
//     const product = await Product.findById(productId)
//       .populate("category", "_id name")
//       .populate("brand", "name")
//       .lean();

//     if (!product || product.isBlocked) {
//       return res.redirect("/user/shop");
//     }

//     // Collect variant images
//     // const allProductImages = (product.variants || [])
//     //   .flatMap((v) => (v.images || []).map((img) => img.url))
//     //   .filter(Boolean);


//     // Group images by variant color
// const variantImages = {};
// (product.variants || []).forEach(v => {
//   if (v.color && v.images && v.images.length) {
//     variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
//   }
// });

// // Flatten all for default
// const allProductImages = variantImages[Object.keys(variantImages)[0]] || [];

//     // Default variant
//     const firstVariant = (product.variants || [])[0] || {};

//     // Clean data object for EJS
//     const viewProduct = {
//       _id: product._id,
//       productName: product.name,
//       salePrice: firstVariant.price || 0,
//       regularPrice: firstVariant.mrp || null,
//       description: product.description || "",
//       productFeatures: product.productFeatures || [],
//       colors: (product.variants || []).map((v) => v.color).filter(Boolean),
//       stock: firstVariant.stock || 0,
//       sku: product.sku || String(product._id),
//       rating: product.rating || 4.5,
//       reviews: product.reviewsCount || 0,
//       category: product.category,
//        brand: product.brand || "BagHub", 
//     };

//     // Related products
//     const relatedProducts = await Product.find({
//       category: product.category?._id,
//       _id: { $ne: product._id },
//       isBlocked: false,
//       isDeleted: false,
//     })
//       .limit(4)
//       .populate("category", "name") 
//       .lean();

//     const formattedRelated = relatedProducts.map((p) => {
//       const fv = (p.variants || [])[0] || {};//get 1st varinet
//       const firstImage =
//         (p.variants || [])
//           .flatMap((v) => (v.images || []).map((img) => img.url))
//           .filter(Boolean)[0] || "/images/placeholder.jpg";

//       return {
//         _id: p._id,
//         productName: p.name,
//         salePrice: fv.price || 0,
//         regularPrice: fv.mrp || null,
//         productImage: [firstImage],
//       };
//     });

//     // ✅ Color map for server-side rendering
//     // const colorMap = {
//     //   black: "#000000",
//     //   blue: "#1e40af",
//     //   red: "#dc2626",
//     //   green: "#059669",
//     //   gray: "#6b7280",
//     //   navy: "#1e3a8a",
//     //   brown: "#92400e",
//     //   white: "#ffffff",
//     // };

//     const colorMap = {
//   black: "#000000",
//   blue: "#1e40af",
//   red: "#dc2626",
//   green: "#059669",
//   gray: "#6b7280",
//   navy: "#1e3a8a",
//   brown: "#92400e",
//   white: "#ffffff",
//   yellow: "#facc15",
//   pink: "#ec4899",
//   purple: "#8b5cf6",
//   orange: "#f97316",
//   beige: "#f5f5dc",
//   silver: "#c0c0c0",
//   gold: "#ffd700",
//   maroon: "#800000",
//   cyan: "#06b6d4",
//   teal: "#14b8a6",
//   olive: "#808000",
//   violet: "#7c3aed",
// };


//     res.render("user/productDetails", {
//       title: `${viewProduct.productName} - BagHub`,
//       product: viewProduct,
//       allProductImages,
//       relatedProducts: formattedRelated,
//       user: req.session?.user || {wishlistCount:0},
//       variantImages, // ✅ pass variant images to EJS
//        colorMap, // ✅ pass color map to EJS
//     });
//   } catch (error) {
//     console.error("❌ Product detail page error:", error);
//     res.redirect("/user/shop");
//   }
// };


// export const getProductDetails = async (req, res) => {
//   try {
//     const productId = req.params.id;

//     // ✅ Populate category and brand (for ObjectId ref)
//     const product = await Product.findById(productId)
//       .populate("category", "_id name")
//       .populate("brand", "name")
//       .lean();

//     if (!product || product.isBlocked) {
//       return res.redirect("/user/shop");
//     }

//     // ✅ Group variant images by color
//     const variantImages = {};
//     (product.variants || []).forEach(v => {
//       if (v.color && v.images && v.images.length) {
//         variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
//       }
//     });

//     const allProductImages = variantImages[Object.keys(variantImages)[0]] || [];
//     const firstVariant = (product.variants || [])[0] || {};

//     const viewProduct = {
//       _id: product._id,
//       productName: product.name,
//       salePrice: firstVariant.price || 0,
//       regularPrice: firstVariant.mrp || null,
//       description: product.description || "",
//       productFeatures: product.productFeatures || [],
//       colors: (product.variants || []).map((v) => v.color).filter(Boolean),
//       stock: firstVariant.stock || 0,
//       sku: product.sku || String(product._id),
//       rating: product.rating || 4.5,
//       reviews: product.reviewsCount || 0,
//       category: product.category,
//       brand: product.brand || "BagHub",
//     };

//     // ✅ Related Products (same category)
//     let relatedProducts = [];

//     if (product.category && product.category._id) {
//       relatedProducts = await Product.find({
//         category: product.category._id,
//         _id: { $ne: product._id },
//         isBlocked: false,
//         isDeleted: false,
//       })
//       .populate("category", "name")
//       .populate("brand", "name")
//       .limit(8)
//       .lean();
//     }

//     // 🧩 Fallback if none found
//     if (!relatedProducts.length) {
//       relatedProducts = await Product.find({
//         isBlocked: false,
//         isDeleted: false,
//         _id: { $ne: product._id },
//       })
//       .populate("category", "name")
//       .populate("brand", "name")
//       .limit(8)
//       .lean();
//     }

//     const formattedRelated = relatedProducts.map((p) => {
//       const fv = (p.variants || [])[0] || {};
//       const firstImage =
//         (p.variants || [])
//           .flatMap((v) => (v.images || []).map((img) => img.url))
//           .filter(Boolean)[0] || "/images/placeholder.jpg";

//       return {
//         _id: p._id,
//         productName: p.name,
//         salePrice: fv.price || 0,
//         regularPrice: fv.mrp || null,
//         productImage: [firstImage],
//         brand: p.brand?.name || "BagHub",
//         rating: p.rating || 4.5,
//       };
//     });

//     console.log("Category:", product.category);
//     console.log("Related Products Found:", relatedProducts.length);

//     const colorMap = {
//       black: "#000000",
//       blue: "#1e40af",
//       red: "#dc2626",
//       green: "#059669",
//       gray: "#6b7280",
//       navy: "#1e3a8a",
//       brown: "#92400e",
//       white: "#ffffff",
//       yellow: "#facc15",
//       pink: "#ec4899",
//       purple: "#8b5cf6",
//       orange: "#f97316",
//       beige: "#f5f5dc",
//       silver: "#c0c0c0",
//       gold: "#ffd700",
//       maroon: "#800000",
//       cyan: "#06b6d4",
//       teal: "#14b8a6",
//       olive: "#808000",
//       violet: "#7c3aed",
//     };

//    res.render("user/productDetails", {
//   title: `${viewProduct.productName} - BagHub`,
//   product: viewProduct,
//   allProductImages,
//   relatedProducts: formattedRelated,
//   user: req.session?.user || { wishlistCount: 0 },
//   variantImages,
//   colorMap,
//   categoryName: product.category?.name || "Other", // ✅ add this line
// });


//   } catch (error) {
//     console.error("❌ Product detail page error:", error);
//     res.redirect("/user/shop");
//   }
// };

// ✅ Get Product Details
// export const getProductDetails = async (req, res) => {
//   try {
//     const productId = req.params.id;

//     // ✅ Populate category and brand (ObjectId ref)
//     const product = await Product.findById(productId)
//       .populate("category", "_id name")
//       .populate("brand", "name")
//       .lean();

//     if (!product || product.isBlocked) {
//       return res.redirect("/shop");
//     }

//     // ✅ Prepare images grouped by variant color
//     const variantImages = {};
//     (product.variants || []).forEach(v => {
//       if (v.color && v.images?.length) {
//         variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
//       }
//     });

//     const firstVariant = (product.variants || [])[0] || {};
//     const allProductImages = variantImages[Object.keys(variantImages)[0]] || [];

//     // ✅ Prepare product info
//     const viewProduct = {
//       _id: product._id,
//       productName: product.name,
//       salePrice: firstVariant.price || 0,
//       regularPrice: firstVariant.mrp || null,
//       description: product.description || "",
//       productFeatures: product.productFeatures || [],
//       colors: (product.variants || []).map(v => v.color).filter(Boolean),
//       stock: firstVariant.stock || 0,
//       sku: product.sku || String(product._id),
//       rating: product.rating || 4.5,
//       reviews: product.reviewsCount || 0,
//       category: product.category,
//       brand: product.brand?.name || "BagHub",
//     };

//     // ✅ Find similar products (same category)
//   const relatedProducts = await Product.find({
//   category: product.category._id,
//   _id: { $ne: product._id },
//   isDeleted: false,
//   isBlocked: false
// })
// .populate("brand", "name")
// .limit(8)
// .lean();


//     // ✅ Fallback to random products if none in same category
//     if (!relatedProducts.length) {
//       relatedProducts = await Product.find({
//         _id: { $ne: product._id },
//         isBlocked: false,
//         isDeleted: false,
//       })
//         .populate("category", "name")
//         .populate("brand", "name")
//         .limit(8)
//         .lean();
//     }

//     // ✅ Format products for EJS
//     const formattedRelated = relatedProducts.map(p => {
//       const fv = (p.variants || [])[0] || {};
//       const firstImage =
//         (p.variants || [])
//           .flatMap(v => (v.images || []).map(img => img.url))
//           .filter(Boolean)[0] || "/images/placeholder.jpg";

//       return {
//         _id: p._id,
//         productName: p.name,
//         salePrice: fv.price || 0,
//         regularPrice: fv.mrp || null,
//         productImage: [firstImage],
//         brand: p.brand?.name || "BagHub",
//         rating: p.rating || 4.5,
//         categoryName: p.category?.name || "Other",
//       };
//     });

//     console.log("✅ Related Products Found:", formattedRelated.length, "for Category:", product.category.name);

//     // ✅ Render
//     res.render("user/productDetails", {
//       title: `${viewProduct.productName} - BagHub`,
//       product: viewProduct,
//       allProductImages,
//       relatedProducts: formattedRelated,
//       categoryName: product.category?.name || "Other",
//       user: req.session?.user || { wishlistCount: 0 },
//       variantImages,
//       colorMap: {
//         black: "#000000",
//         blue: "#1e40af",
//         red: "#dc2626",
//         green: "#059669",
//         gray: "#6b7280",
//         brown: "#92400e",
//         white: "#ffffff",
//         yellow: "#facc15",
//         pink: "#ec4899",
//         purple: "#8b5cf6",
//         orange: "#f97316",
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error loading product details:", error);
//     res.redirect("/shop");
//   }
// };


// export const getProductDetails = async (req, res) => {
//   try {
//     const productId = req.params.id;

//     // ✅ Populate category & brand
//     const product = await Product.findById(productId)
//       .populate("category", "_id name")
//       .populate("brand", "name")
//       .lean();

//     if (!product || product.isBlocked || product.isDeleted) {
//       return res.redirect("/shop");
//     }

//     // ✅ Prepare variant images grouped by color
//     const variantImages = {};
//     (product.variants || []).forEach(v => {
//       if (v.color && v.images?.length) {
//         variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
//       }
//     });

//     const firstVariant = (product.variants || [])[0] || {};
//     const allProductImages = variantImages[Object.keys(variantImages)[0]] || [];

//     // ✅ Main product object for EJS
//     const viewProduct = {
//       _id: product._id,
//       productName: product.name,
//       salePrice: firstVariant.price || 0,
//       regularPrice: firstVariant.mrp || null,
//       description: product.description || "",
//       productFeatures: product.productFeatures || [],
//       colors: (product.variants || []).map(v => v.color).filter(Boolean),
//       stock: firstVariant.stock || 0,
//       sku: product.sku || String(product._id),
//       rating: product.rating || 4.5,
//       reviews: product.reviewsCount || 0,
//       category: product.category,
//       brand: product.brand?.name || "BagHub",
//     };

//     /* ----------------------------------------------------------
//        ✅ 1. Get related products (same category)
//     ---------------------------------------------------------- */
//    /* ----------------------------------------------------------
//    ✅ Fetch Related Products (with debugging)
// ---------------------------------------------------------- */
// let relatedProducts = [];

// try {
//   console.log("🔍 Debug Info:");
//   console.log("Product ID:", product._id);
//   console.log("Product Category Object:", product.category);
//   console.log("Category ID for Query:", product.category?._id || product.category);

//   relatedProducts = await Product.find({
//     category: product.category?._id || product.category, // ✅ safer category handling
//     _id: { $ne: product._id },
//     isDeleted: false,
//     isBlocked: false,
//   })
//     .populate("category", "name")
//     .populate("brand", "name")
//     .limit(8)
//     .lean();

//   console.log("✅ Related products found:", relatedProducts.length);
//   if (relatedProducts.length) {
//     console.log("Sample product names:", relatedProducts.map(p => p.name));
//   } else {
//     console.log("⚠️ No related products found for category:", product.category?.name);
//   }

//   // ✅ Fallback: same brand if category has no related
//   if (!relatedProducts.length && product.brand) {
//     relatedProducts = await Product.find({
//       brand: product.brand._id,
//       _id: { $ne: product._id },
//       isDeleted: false,
//       isBlocked: false,
//     })
//       .populate("category", "name")
//       .populate("brand", "name")
//       .limit(8)
//       .lean();

//     console.log("🔁 Used brand fallback. Found:", relatedProducts.length);
//   }
// } catch (err) {
//   console.error("❌ Error fetching related products:", err);
// }


//     // /* ----------------------------------------------------------
//     //    ✅ 2. Fallback: if no same-category products, use same brand
//     // ---------------------------------------------------------- */
//     // if (!relatedProducts.length && product.brand) {
//     //   relatedProducts = await Product.find({
//     //     brand: product.brand._id,
//     //     _id: { $ne: product._id },
//     //     isDeleted: false,
//     //     isBlocked: false,
//     //   })
//     //     .populate("category", "name")
//     //     .populate("brand", "name")
//     //     .limit(8)
//     //     .lean();
//     // }

//     /* ----------------------------------------------------------
//        ✅ 3. Fallback: if still none, show random 8 products
//     ---------------------------------------------------------- */
//     if (!relatedProducts.length) {
//       relatedProducts = await Product.find({
//         _id: { $ne: product._id },
//         isDeleted: false,
//         isBlocked: false,
//       })
//         .populate("category", "name")
//         .populate("brand", "name")
//         .limit(8)
//         .lean();
//     }

//     /* ----------------------------------------------------------
//        ✅ 4. Format related products for EJS
//     ---------------------------------------------------------- */
//     const formattedRelated = relatedProducts.map(p => {
//       const fv = (p.variants || [])[0] || {};
//       const firstImage =
//         (p.variants || [])
//           .flatMap(v => (v.images || []).map(img => img.url))
//           .filter(Boolean)[0] || "/images/placeholder.jpg";

//       return {
//         _id: p._id,
//         productName: p.name,
//         salePrice: fv.price || 0,
//         regularPrice: fv.mrp || null,
//         productImage: [firstImage],
//         brand: p.brand?.name || "BagHub",
//         rating: p.rating || 4.5,
//         categoryName: p.category?.name || "Other",
//       };
//     });

//     console.log(
//       `✅ Related Products Found: ${formattedRelated.length} for Category: ${product.category?.name}`
//     );

//     /* ----------------------------------------------------------
//        ✅ Render EJS
//     ---------------------------------------------------------- */
//     res.render("user/productDetails", {
//       title: `${viewProduct.productName} - BagHub`,
//       product: viewProduct,
//       allProductImages,
//       relatedProducts: formattedRelated,
//       categoryName: product.category?.name || "Other",
//       user: req.session?.user || { wishlistCount: 0 },
//       variantImages,
//       colorMap: {
//         black: "#000000",
//         blue: "#1e40af",
//         red: "#dc2626",
//         green: "#059669",
//         gray: "#6b7280",
//         brown: "#92400e",
//         white: "#ffffff",
//         yellow: "#facc15",
//         pink: "#ec4899",
//         purple: "#8b5cf6",
//         orange: "#f97316",
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error loading product details:", error);
//     res.redirect("/shop");
//   }
// };



// // ✅ Get variant details (images, price, stock) by color
// export const getVariantByColor = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const { color } = req.query;

//     const product = await Product.findById(productId).lean();
//     if (!product) return res.status(404).json({ success: false, message: "Product not found" });

//     const variant = (product.variants || []).find(
//       v => v.color.toLowerCase() === color.toLowerCase()
//     );

//     if (!variant) {
//       return res.status(404).json({ success: false, message: "Variant not found" });
//     }

//     res.json({
//       success: true,
//       variant: {
//         color: variant.color,
//         price: variant.price,
//         mrp: variant.mrp,
//         stock: variant.stock,
//         images: (variant.images || []).map(img => img.url),
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching variant:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };



// export const getProductDetails = async (req, res) => {
//   try {
//     const productId = req.params.id;

//     // ✅ Populate category & brand
//     const product = await Product.findById(productId)
//       .populate("category", "_id name")
//       .populate("brand", "name")
//       .lean();

//     if (!product || product.isBlocked || product.isDeleted) {
//       return res.redirect("/shop");
//     }

//     // ✅ Prepare variant images grouped by color
//     const variantImages = {};
//     (product.variants || []).forEach(v => {
//       if (v.color && v.images?.length) {
//         variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
//       }
//     });

//     const firstVariant = (product.variants || [])[0] || {};
//     const allProductImages = variantImages[Object.keys(variantImages)[0]] || [];

//     // ✅ Main product object for EJS
//     const viewProduct = {
//       _id: product._id,
//       productName: product.name,
//       salePrice: firstVariant.price || 0,
//       regularPrice: firstVariant.mrp || null,
//       description: product.description || "",
//       productFeatures: product.productFeatures || [],
//       colors: (product.variants || []).map(v => v.color).filter(Boolean),
//       stock: firstVariant.stock || 0,
//       sku: product.sku || String(product._id),
//       rating: product.rating || 4.5,
//       reviews: product.reviewsCount || 0,
//       category: product.category,
//       brand: product.brand?.name || "BagHub",
//     };

//     /* ----------------------------------------------------------
//        ✅ Fetch Related Products (same category or brand fallback)
//     ---------------------------------------------------------- */
// //     let relatedProducts = [];

// //     console.log("🔍 Debug Info:");
// //     console.log("Product ID:", product._id);
// //     console.log("Product Category Object:", product.category);
// //     console.log("Category ID for Query:", product.category?._id || product.category);

// //     // ✅ 1. Try same-category products
  

// //     console.log("✅ Related products found:", relatedProducts.length);
// //     if (relatedProducts.length) {
// //       console.log("Sample product names:", relatedProducts.map(p => p.name));
// //     } else {
// //       console.log("⚠️ No related products found for category:", product.category?.name);
// //     }

// //     // ✅ 2. Fallback to same brand
  

// //     // ✅ 3. Fallback to random if still none
// //     if (!relatedProducts.length) {
// //       relatedProducts = await Product.find({
// //         _id: { $ne: product._id },
// //         isDeleted: false,
// //         isBlocked: false,
// //       })
// //         .populate("category", "name")
// //         .populate("brand", "name")
// //         .limit(8)
// //         .lean();

// //       console.log("🌀 Used random fallback. Found:", relatedProducts.length);
// //     }

// //     /* ----------------------------------------------------------
// //        ✅ Format related products for EJS
// //     ---------------------------------------------------------- */
// //    const formattedRelated = relatedProducts.map(p => {
// //   const fv = (p.variants || [])[0] || {};
// //   const firstImage =
// //     (p.variants || [])
// //       .flatMap(v => (v.images || []).map(img => (typeof img === "string" ? img : img.url)))
// //       .filter(Boolean)[0] || "/images/placeholder.jpg";

// //   return {
// //     _id: p._id,
// //     productName: p.name,
// //     salePrice: fv.price || 0,
// //     regularPrice: fv.mrp || null,
// //     productImage: [firstImage],
// //     brand: p.brand?.name || "BagHub",
// //     rating: p.rating || 4.5,
// //     categoryName: p.category?.name || "Other",
// //   };
// // });


// //     console.log(
// //       `✅ Related Products Prepared: ${formattedRelated.length} for Category: ${product.category?.name}`
// //     );


// let relatedProducts = [];

// // Step 1️⃣: Try to find related products by category
// if (product.category) {
//   relatedProducts = await Product.find({
//     category: product.category,
//     _id: { $ne: product._id },
//     isDeleted: false,
//     isActive: true
//   })
//     .populate("category", "name")
//     .limit(8)
//     .lean();

//   console.log("✅ Found by category:", relatedProducts.length);
// }

// // Step 2️⃣: If no related products, fall back to brand name
// if (!relatedProducts.length && product.brand) {
//   relatedProducts = await Product.find({
//     brand: product.brand,
//     _id: { $ne: product._id },
//     isDeleted: false,
//     isActive: true
//   })
//     .populate("category", "name")
//     .limit(8)
//     .lean();

//   console.log("🔁 Used brand fallback:", relatedProducts.length);
// }


//     /* ----------------------------------------------------------
//        ✅ Render EJS
//     ---------------------------------------------------------- */
//     res.render("user/productDetails", {
//       title: `${viewProduct.productName} - BagHub`,
//       product: viewProduct,
//       allProductImages,
//       relatedProducts: formattedRelated,
//       categoryName: product.category?.name || "Other",
//       user: req.session?.user || { wishlistCount: 0 },
//       variantImages,
//       colorMap: {
//         black: "#000000",
//         blue: "#1e40af",
//         red: "#dc2626",
//         green: "#059669",
//         gray: "#6b7280",
//         brown: "#92400e",
//         white: "#ffffff",
//         yellow: "#facc15",
//         pink: "#ec4899",
//         purple: "#8b5cf6",
//         orange: "#f97316",
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error loading product details:", error);
//     res.redirect("/shop");
//   }
// };




export const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    // ✅ Fetch product with category populated
    const product = await Product.findById(productId)
      .populate("category", "_id name")
      .lean();

    if (!product || product.isDeleted || product.isBlocked === true) {
      return res.redirect("/shop");
    }

    // ✅ Prepare variant images grouped by color
    const variantImages = {};
    (product.variants || []).forEach(v => {
      if (v.color && v.images?.length) {
        variantImages[v.color.toLowerCase()] = v.images.map(img => img.url);
      }
    });

    const firstVariant = (product.variants || [])[0] || {};
    const allProductImages =
      variantImages[Object.keys(variantImages)[0]] || [];

    // ✅ Main Product object for EJS
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

    /* ----------------------------------------------------------
       ✅ Fetch Related Products
       Priority: 1️⃣ Category → 2️⃣ Brand → 3️⃣ Random
    ---------------------------------------------------------- */
    let relatedProducts = [];

    // 1️⃣ Related by Category
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
        console.log(`✅ Found ${relatedProducts.length} related products by category`);
    }

    // 2️⃣ Fallback: Related by Brand
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
        console.log(`🔁 Found ${relatedProducts.length} related products by brand`);
    }

    // 3️⃣ Fallback: Random products
    if (!relatedProducts.length) {
      relatedProducts = await Product.aggregate([
        { $match: { _id: { $ne: product._id }, isDeleted: false, isActive: true } },
        { $sample: { size: 8 } }, // randomly pick 8
      ]);

      console.log(`🌀 Used random fallback. Found: ${relatedProducts.length}`);
    }

    /* ----------------------------------------------------------
       ✅ Format Related Products for EJS
    ---------------------------------------------------------- */
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
        productName: p.name,
        salePrice: fv.price || 0,
        regularPrice: fv.mrp || null,
        productImage: [firstImage],
        brand: p.brand || "BagHub",
        rating: p.rating || 4.5,
        categoryName: p.category?.name || "Other",
      };
    });

    /* ----------------------------------------------------------
       ✅ Render EJS
    ---------------------------------------------------------- */
    res.render("user/productDetails", {
      title: `${viewProduct.productName} - BagHub`,
      product: viewProduct,
      allProductImages,
      relatedProducts: formattedRelated,
      categoryName: product.category?.name || "Other",
      user: req.session?.user || { wishlistCount: 0 },
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
    console.error("❌ Error loading product details:", error);
    res.redirect("/shop");
  }
};


export const getVariantByColor = async (req, res) => {
  try {
    const { productId } = req.params;
    const { color } = req.query;

    const product = await Product.findById(productId)
      .populate("brand", "name") // make sure brand is populated
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const variant = (product.variants || []).find(
      v => v.color && v.color.toLowerCase() === color.toLowerCase()
    );

    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    // ✅ Ensure brand is taken from populated object or fallback
    const brandName =
      (product.brand && (product.brand.name || product.brand)) || "BagHub";

    res.json({
      success: true,
      variant: {
        color: variant.color,
        price: variant.price,
        mrp: variant.mrp,
        stock: variant.stock,
        images: (variant.images || []).map(img => img.url),
        brand: brandName, // ✅ included here
      },
    });
  } catch (error) {
    console.error("❌ Error fetching variant:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



