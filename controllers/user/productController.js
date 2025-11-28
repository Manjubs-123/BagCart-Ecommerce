
import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import User from "../../models/userModel.js";

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

    let userWishlistIds = [];

    // If user is logged in, load their wishlist
    if (req.session.user && req.session.user.id) {
      const user = await User.findById(req.session.user.id).select("wishlist");
      if (user) {
        userWishlistIds = user.wishlist.map(id => id.toString());
      }
    }

    res.render("user/landing", {
      title: "BagHub | Explore Premium Bags",
      currentPage: "home",
      featuredProducts,
      favouriteProducts,
      handpickedProducts,
      trendingProducts,
      userWishlistIds,              
      user: req.session.user || null
    });

  } catch (error) {
    console.error("Error rendering landing page:", error);
    res.status(500).send("Failed to load landing page");
  }
};

















