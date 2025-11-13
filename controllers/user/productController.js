// import Product from "../../models/productModel.js";
// import Category from "../../models/category.js";

// export const renderHomePage = async (req, res) => {
//   try {
//     // Fetch only active, non-deleted products
//     const products = await Product.find({ isDeleted: false, isActive: true })
//       .populate("category", "name")
//       .sort({ createdAt: -1 })
//       .lean();

//     // Map products for frontend
//     const featuredProducts = products.map(product => {
//       const firstVariant = product.variants?.[0];
//       const primaryImage = firstVariant?.images?.[0]?.url || "/images/no-image.jpg";
//       return {
//         _id: product._id,
//         name: product.name,
//         brand: product.brand,
//         category: product.category?.name || "Uncategorized",
//         price: firstVariant?.price || 0,
//         image: primaryImage
//       };
//     });

//     res.render("index", {
//       title: "BagHub | Premium Backpacks & Bags",
//       featuredProducts
//     });

//   } catch (error) {
//     console.error("Error rendering home page:", error);
//     res.status(500).send("Failed to load home page");
//   }
// };

// import Product from "../../models/productModel.js";

// export const renderHomePage = async (req, res) => {
//   try {
//     // Get all active, non-deleted products
//     const allProducts = await Product.find({ isDeleted: false, isActive: true })
//       .populate("category", "name")
//       .sort({ createdAt: -1 })
//       .lean();

//     if (!allProducts || allProducts.length === 0) {
//       return res.render("index", {
//         title: "BagHub | Premium Backpacks & Bags",
//         featuredProducts: [],
//         favouriteProducts: [],
//         handpickedProducts: [],
//         trendingProducts: []
//       });
//     }

//     // Create different product groups
//     const featuredProducts = allProducts.slice(0, 8); // newest
//     const favouriteProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 8); // random
//     const handpickedProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 8); // random again
//     const trendingProducts = [...allProducts].sort((a, b) => b.variants[0]?.stock - a.variants[0]?.stock).slice(0, 8); // based on stock (or replace with createdAt)

//     //  Render index.ejs and send all 4 arrays
//    res.render("index", {
//   title: "BagHub | Premium Backpacks & Bags",
//   currentPage: "home", // ✅ add this line
//   featuredProducts,
//   favouriteProducts,
//   handpickedProducts,
//   trendingProducts
// });


//   } catch (error) {
//     console.error("Error rendering home page:", error);
//     res.status(500).send("Failed to load products");
//   }
// };
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
//     const products = await Product.find({ isDeleted: false, isActive: true })
//       .populate("category", "name")
//       .sort({ createdAt: -1 })
//       .lean();

//     res.render("user/shop", {
//       title: "Shop | BagHub",
//       products,
//       user: req.session.user || null,
//     });
//   } catch (error) {
//     console.error("Error rendering shop page:", error);
//     res.status(500).send("Failed to load shop page");
//   }
// };


export const renderShopPage = async (req, res) => {
  try {
       // ✅ If user not logged in, redirect to login
    if (!req.session.user) {
      return res.redirect("/user/login");
    }
    const selectedCategories = Array.isArray(req.query.category)
      ? req.query.category
      : req.query.category
      ? [req.query.category]
      : [];

    // ✅ Add this line — your available color filters
    const colors = ["Black", "Blue", "Brown", "Grey", "Red", "Green", "Navy", "Orange"];

        // ✅ Load active categories

    const categories = await Category.find({ isDeleted: false })
      .sort({ name: 1 })
      .lean();

       // ✅ Build filter
    const filter = { isDeleted: false, isActive: true };
    if (selectedCategories.length > 0) {
      filter.category = { $in: selectedCategories };
    }
 // ✅ Fetch products
    const products = await Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Pass `colors` to EJS
    res.render("user/shop", {
      title: "Shop | BagHub",
      products,
      categories,
      selectedCategories,
      colors, // ✅ FIXED
      user: req.session.user || null,
    });
  } catch (error) {
    console.error("Error rendering shop page:", error);
    res.status(500).send("Failed to load shop page");
  }
};




