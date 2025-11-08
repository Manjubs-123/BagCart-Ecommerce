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

const loadHomeProducts = async () => {
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
    const { featuredProducts, favouriteProducts, handpickedProducts, trendingProducts } = await loadHomeProducts();

    res.render("index", {
      title: "BagHub | Premium Backpacks & Bags",
      currentPage: "home",
      featuredProducts,
      favouriteProducts,
      handpickedProducts,
      trendingProducts
    });
  } catch (error) {
    console.error("Error rendering home page:", error);
    res.status(500).send("Failed to load products");
  }
};

// Landing Page
export const renderLandingPage = async (req, res) => {
  try {
    const { featuredProducts, favouriteProducts, handpickedProducts, trendingProducts } = await loadHomeProducts();

    res.render("user/landing", {
      title: "BagHub | Explore Premium Bags",
      currentPage: "home",
      featuredProducts,
      favouriteProducts,
      handpickedProducts,
      trendingProducts
    });
  } catch (error) {
    console.error("Error rendering landing page:", error);
    res.status(500).send("Failed to load landing page");
  }
};


