import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
  

// Show product list
export const listProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false }).populate("category");
    res.render("admin/productList", { products, q: req.query.q || "" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Render Add Product Page
export const renderAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false });
    res.render("admin/addProduct", { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Capture product details temporarily (don’t save in DB)
export const addProduct = async (req, res) => {
  try {
    const { name, brand, category, description } = req.body;

    if (!name || !brand || !category) {
      return res.status(400).send("All fields are required");
    }

    // Temporarily store product data in session
    req.session.tempProduct = { name, brand, category, description };
    console.log("Temp Product stored in session:", req.session.tempProduct);

    // Redirect to add variant page
    res.redirect("/admin/products/variants");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

//Render Add Variant Page
export const renderAddVariants = async (req, res) => {
  try {
    const tempProduct = req.session.tempProduct;
    if (!tempProduct) {
      return res.redirect("/admin/products/add");
    }

    res.render("admin/addProductVariants", { product: tempProduct });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
// Save Product + First Variant (now commit to DB)

export const saveProduct = async (req, res) => {
  try {
    const tempProduct = req.session.tempProduct;

    if (!tempProduct) {
      return res.redirect("/admin/products/add");
    }

    const { colour, price, stock } = req.body;

    if (!req.files || req.files.length < 3) {
      return res.status(400).send("Please upload at least 3 images");
    }

    // -------------------------------
    // Ensure upload folder exists
    // -------------------------------
    const uploadDir = path.join("public", "uploads", "products");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    console.log(req.files,"req.files is coming")
    // -------------------------------
    // Process & resize images
    // -------------------------------
    const imageUrls = [];
    for (const file of req.files) {
      const outputPath = path.join(uploadDir, `${Date.now()}-${file.originalname}`);
      console.log(outputPath,"outputPath")
      await sharp(file.path).resize(600, 600).toFile(outputPath);
      fs.unlinkSync(file.path); // delete temp file
      imageUrls.push(outputPath.replace("public/", ""));
    }

    // Construct variant object
    const variant = {
      colour,
      price,
      stock,
      images: imageUrls,
    };

    // Create Product finally in DB
    const newProduct = new Product({
      name: tempProduct.name,
      brand: tempProduct.brand,
      category: tempProduct.category,
      description: tempProduct.description,
      variants: [variant],
    });

    await newProduct.save();

    // Clear temp session
    req.session.tempProduct = null;

    res.redirect("/admin/products");
  } catch (err) {
    console.error("Error saving product:", err);
    res.status(500).send("Server Error");
  }
};


// Optional: Soft Delete Product
export const softDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found");

    product.isDeleted = !product.isDeleted;
    await product.save();
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
