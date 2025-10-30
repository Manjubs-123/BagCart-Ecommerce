import Product from "../../models/productModel.js";
import Category from "../../models/category.js";

export const getShopPage = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 12, category: categoryFilter } = req.query;

    // 🟢 1. Fetch only active categories
    const categories = await Category.find({
      isDeleted: false,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    // 🟢 2. Build base filter
    const filter = { isDeleted: false, isActive: true };

    // 🔍 Search filter (by product name, brand, description)
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { brand: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // 🏷️ Category filter
    if (categoryFilter) {
      const catArray = Array.isArray(categoryFilter)
        ? categoryFilter
        : [categoryFilter];
      filter.category = { $in: catArray };
    }

    // 🟢 3. Pagination setup
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    // 🟢 4. Fetch products and populate category
    let products = await Product.find(filter)
      .populate({
        path: "category",
        match: { isDeleted: false, isActive: true },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 🧹 Remove products without valid category
    products = products.filter((p) => p.category);

     // 🧠 DEBUG: check if Cloudinary image URLs are stored correctly
    console.log("🟢 Products fetched for user side:", products[0]?.variants?.[0]?.images);

    // 🟢 5. Extract unique colors from variants
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

    // 🟢 6. Pagination totals
    const totalCount = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    // 🟢 7. Pass selected categories for UI highlight
    const selectedCategories = Array.isArray(req.query.category)
      ? req.query.category.map(String)
      : req.query.category
      ? [String(req.query.category)]
      : [];

    // 🟢 8. Render EJS with all required data
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



// 🎯 Filter Products (AJAX)
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

    // 🎨 Filter by variant color
    if (colors?.length) {
      filter["variants.color"] = { $in: colors };
    }

    // 💰 Price filter via variant price range
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = parseFloat(minPrice);
    if (maxPrice) priceFilter.$lte = parseFloat(maxPrice);
    if (Object.keys(priceFilter).length) {
      filter["variants.price"] = priceFilter;
    }

    let products = await Product.find(filter)
      .populate("category")
      .lean();

    // 🔽 Sort
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



