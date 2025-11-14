
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";

export const loadHomeProducts = async () => {
  const allProducts = await Product.find({ isDeleted: false, isActive: true })
    .populate("category", "name")
    .sort({ createdAt: -1 })
    .lean();

  if (!allProducts || allProducts.length === 0) {
    return {
      featuredProducts: [],
      favouriteProducts: [],
      handpickedProducts: [],
      trendingProducts: []
    };
  }

  const featuredProducts = allProducts.slice(0, 8);
  const favouriteProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 8);
  const handpickedProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 8);
  const trendingProducts = [...allProducts]
    .sort((a, b) => (b.variants[0]?.stock || 0) - (a.variants[0]?.stock || 0))
    .slice(0, 8);

  return { featuredProducts, favouriteProducts, handpickedProducts, trendingProducts };
};

// Home Page
export const renderHomePage = async (req, res) => {
  try {

    if (req.session.user) {
      return res.redirect("/user/home");
    }

    const { featuredProducts, favouriteProducts, handpickedProducts, trendingProducts } = await loadHomeProducts();

    res.render("index", {
      title: "BagHub | Premium Backpacks & Bags",
      currentPage: "home",
      featuredProducts,
      favouriteProducts,
      handpickedProducts,
      trendingProducts,
      user: req.session.user || null,
    });
  } catch (error) {
    console.error("Error rendering home page:", error);
    res.status(500).send("Failed to load products");
  }
};

export const renderLandingPage = async (req, res) => {
  try {
    const { featuredProducts, favouriteProducts, handpickedProducts, trendingProducts } = await loadHomeProducts();

    res.render("user/landing", {
      title: "BagHub | Explore Premium Bags",
      currentPage: "home",
      //  user: req.session.user || null,
      featuredProducts,
      favouriteProducts,
      handpickedProducts,
      trendingProducts,
      user: req.session.user || null,  // add user data if logged in
    });
  } catch (error) {
    console.error("Error rendering landing page:", error);
    res.status(500).send("Failed to load landing page");
  }
};

// export const renderShopPage = async (req, res) => {
//   try {
//     //If user not logged in, redirect to login
//     if (!req.session.user) {
//       return res.redirect("/user/login");
//     }
//     const selectedCategories = Array.isArray(req.query.category)
//       ? req.query.category
//       : req.query.category
//         ? [req.query.category]
//         : [];

//     // Add this line — your available color filters
//     // const colors = ["Black", "Blue", "Brown", "Grey", "Red", "Green", "Navy", "Orange"];
//      products = await Product.find(filter)
//       .populate({
//         path: "category",
//         match: { isDeleted: false, isActive: true },
//       })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     // Remove products without valid category
//     let product = products.filter((p) => p.category);
//     const colors = [
//       ...new Set(
//         product.flatMap((p) =>
//           Array.isArray(p.variants)
//             ? p.variants
//               .map((v) => v.color?.trim())
//               .filter(Boolean)
//             : []
//         )
//       ),
//     ];

//     // Load active categories

//     const categories = await Category.find({ isDeleted: false })
//       .sort({ name: 1 })
//       .lean();

//     // Build filter
//     const filter = { isDeleted: false, isActive: true };
//     if (selectedCategories.length > 0) {
//       filter.category = { $in: selectedCategories };
//     }
//     //  Fetch products
//     const products = await Product.find(filter)
//       .populate("category", "name")
//       .sort({ createdAt: -1 })
//       .lean();

//     //  Pass `colors` to EJS
//     res.render("user/shop", {
//       title: "Shop | BagHub",
//       products,
//       categories,
//       selectedCategories,
//       colors,
//       user: req.session.user || null,
//     });
//   } catch (error) {
//     console.error("Error rendering shop page:", error);
//     res.status(500).send("Failed to load shop page");
//   }
// };


















