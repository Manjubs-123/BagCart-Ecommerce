// // export const getHome = async (req, res) => {
// //   try {
// //     const products = await Product.find({ isActive: true, isDeleted: false })
// //       .populate("category", "name")
// //       .sort({ createdAt: -1 })
// //       .limit(8)
// //       .lean();

// //     res.render("index", {
// //       products,
// //       currentParsge: "home", // ✅ add this line
// //     });
// //   } catch (error) {
// //     console.error("Home page load error:", error);
// //     res.status(500).send("Server Error");
// //   }
// // };
// export const getHome = async (req, res) => {
//   try {
//     const products = await Product.find({ isActive: true, isDeleted: false }).lean();

//     res.render("index", {
//       products,
//       currentPage: "home" // 👈 tells header.ejs this is homepage
//     });
//   } catch (error) {
//     res.status(500).send("Error loading homepage");
//   }
// };
