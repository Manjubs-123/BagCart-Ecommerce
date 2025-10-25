import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
  

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

    console.log(req.files, "req.files is coming");

    // -------------------------------
    // Process, resize & upload images
    // -------------------------------
    const imageUrls = [];

    for (const file of req.files) {
      // Resize image locally first
      const tempOutputPath = path.join("public", "temp", `${Date.now()}-${file.originalname}`);

      // Ensure temp folder exists
      const tempDir = path.dirname(tempOutputPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      await sharp(file.path).resize(600, 600).toFile(tempOutputPath);

      // Delete the multer temp file
      fs.unlinkSync(file.path);

      // Upload resized image to Cloudinary
      const result = await cloudinary.uploader.upload(tempOutputPath, {
        folder: "products",
      });
console.log(result,"result")
      // Delete the resized local copy
      fs.unlinkSync(tempOutputPath);

      // Push the Cloudinary secure URL
      imageUrls.push(result.secure_url);
    }

    // -------------------------------
    // Construct product variant object
    // -------------------------------
    const variant = {
      colour,
      price,
      stock,
      images: imageUrls,
    };

    // -------------------------------
    // Create final product in MongoDB
    // -------------------------------
    const newProduct = new Product({
      name: tempProduct.name,
      brand: tempProduct.brand,
      category: tempProduct.category,
      description: tempProduct.description,
      variants: [variant],
      isListed: true,
      isBlocked: false,
    });

    await newProduct.save();

    // -------------------------------
    // Clear temporary session data
    // -------------------------------
    req.session.tempProduct = null;

    res.redirect("/admin/products");
  } catch (err) {
    console.error("❌ Error saving product:", err);
    res.status(500).send("Server Error: " + err.message);
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
