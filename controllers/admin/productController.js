import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import { cloudinary } from "../../config/cloudinary.js";
import fs from 'fs/promises';


// List products (with search and pagination)
export const listProducts = async (req, res) => {
  try {
    
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const q = (req.query.q || "").trim();

    const filter = { isDeleted: false };

    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
      ];
    }

    
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
    const skip = (page - 1) * limit;

    
    const products = await Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render("admin/productList", {
      title: "Product List",
      products,
      q,
      page,
      totalPages,
      limit
    });
  } catch (error) {
    console.error("Error loading products:", error);
    res.status(500).send("Server Error");
  }
};


// Render Add Product page
export const renderAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();
   
    const colors = [
      'Black','Blue','Brown','Gray','Red','Green','Yellow','White','Pink','Purple','Orange'
    ];

    return res.render('admin/addProduct', {
      title: 'Add Product',
      categories,
      colors
    });
  } catch (error) {
    console.error('Render Add Product Error:', error);
    return res.status(500).send('Failed to render add product page');
  }
};
  
// Get all products (excluding soft deleted)
export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '' } = req.query;

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const skip = (page - 1) * limit;

    const [rawProducts, total] = await Promise.all([
      Product.find(query)
        .populate({ path: 'category', match: { isActive: true, isDeleted: false } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);

    // Filter out products whose category was filtered out by populate (blocked/deleted categories)
    const products = rawProducts.filter(p => p.category != null);
   
    // console.log(" Product image check:", products[0]?.variants?.[0]?.images);

    
    res.render("admin/productList", {
      products,
      q: search,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      },
    });

  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).send("Failed to load products");
  }
};


// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({ 
      _id: id,  
      isDeleted: false 
    }).populate('category');
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch product',
      error: error.message 
    });
  }
};

// Get active categories (not blocked)
export const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, isDeleted: false })
      .select('name description')
      .sort({ name: 1 })
      .lean();
      
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: error.message 
    });
  }
};


export const addProduct = async (req, res) => {
  try {
    console.log("Incoming body:", req.body);
    console.log("Incoming files:", req.files);

    let { name, description, brand, category, variants } = req.body;

    //  Parse or normalize variants
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch (err) {
        console.error("Failed to parse variants JSON:", err);
        variants = [];
      }
    }


    // Handle images for each variant (CLOUDINARY mapped to schema)
    if (Array.isArray(variants) && req.files?.length) {
      variants = variants.map((variant, index) => {
        // Find matching images for this variant using file name pattern
        const images = req.files
          .filter(f => f.originalname.startsWith(`variant${index}_`))
          .map(f => ({
            url: f.path,        // Cloudinary image URL
            publicId: f.filename // Cloudinary public ID
          }));

        return {
          color: variant.color?.trim(),
          price: parseFloat(variant.price),
          stock: parseInt(variant.stock),
          images
        };
      });
    }

    console.log(" Prepared variants before save:", JSON.stringify(variants, null, 2));



    const existingProduct=await Product.findOne({
      name:{$regex:`^${name.trim()}$`,$options:"i"}//exact matching or case sensitive
   
    })
    if(existingProduct){
      return res.status(400).json({
        message:"Product name alreday exists.Please choose a different name.",
        success:false
      });
    }
     //  Validation

    if (!name || !description || !brand || !category)
      return res.status(400).json({ message: "Missing required fields" });

    if (!variants || variants.length === 0)
      return res.status(400).json({ message: "At least one variant is required" });

    // Create and save product
    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      brand: brand.trim(),
      category,
      variants,
      isActive: true,
      isDeleted: false
    });

    await newProduct.save();

    console.log(" Saved product variant images:", newProduct.variants[0]?.images);

    res.status(201).json({
      message: "Product added successfully",
      product: newProduct
    });
  } catch (error) {
    console.error(" Add product error:", error);
    res.status(500).json({
      message: "Failed to add product",
      error: error.message
    });
  }
};

// Render Edit Product Page
export const renderEditProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, isDeleted: false })
      .populate('category')
      .lean();

    if (!product) {
      return res.status(404).send("Product not found");
    }

    
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();

    const colors = [
      'Black', 'Blue', 'Brown', 'Gray', 'Red', 'Green', 'Yellow', 'White', 'Pink', 'Purple', 'Orange'
    ];

    return res.render("admin/editProduct", {
      title: "Edit Product",
      product,
      categories,
      colors
    });
  } catch (error) {
    console.error("Render Edit Product Error:", error);
    return res.status(500).send("Failed to render edit product page");
  }


};


export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, description, brand, category, variants } = req.body;

    //  Parse variants safely
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch {
        variants = [];
      }
    }

    // Helper functions
    const numOr = (val, fallback = 0, asInt = false) => {
      const n = asInt ? parseInt(val) : parseFloat(val);
      return Number.isFinite(n) ? n : fallback;
    };
    const strOr = (s, fallback = "") =>
      (typeof s === "string" ? s.trim() : (s ?? "")).trim() || fallback;

    //  Find existing product
    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    // Update base fields
    product.name = strOr(name, product.name);
    product.description = strOr(description, product.description);
    product.brand = strOr(brand, product.brand);
    if (category) product.category = category;

    // Handle variants
    const updatedVariants = [];
    const existingVariants = product.variants || [];

    // Helper to collect uploaded images
    const getUploadedImages = (variantIndex) =>
      (req.files || [])
        .filter((f) => f.originalname.startsWith(`variant${variantIndex}_slot`))
        .map((f) => ({
          url: f.path,
          publicId: f.filename,
          slot: parseInt(f.originalname.match(/slot(\d+)/)?.[1] || 0, 10),
        }));

    for (let i = 0; i < variants.length; i++) {
      const vMeta = variants[i] || {};
      const oldVariant = existingVariants[i];
      const uploadedImages = getUploadedImages(i);

      //  NEW VARIANT
      if (!oldVariant) {
        const newImages = uploadedImages.map((img) => ({
          url: img.url,
          publicId: img.publicId,
        }));

        updatedVariants.push({
          color: strOr(vMeta.color, "Unknown"),
          price: numOr(vMeta.price, 0, false),
          stock: numOr(vMeta.stock, 0, true),
          images: newImages.length ? newImages : [],
        });
        continue;
      }

      //  EXISTING VARIANT
      const totalSlots = Math.max(
        oldVariant.images?.length || 0,
        ...uploadedImages.map((img) => img.slot + 1),
        3
      );

      const mergedImages = [];
      for (let slot = 0; slot < totalSlots; slot++) {
        const replaced = uploadedImages.find((img) => img.slot === slot);
        const existingImg = oldVariant.images?.[slot] || null;

        if (replaced) {
          // Delete old Cloudinary image
          if (existingImg?.publicId) {
            try {
              await cloudinary.uploader.destroy(existingImg.publicId);
            } catch (err) {
              console.warn(" Failed to delete old Cloudinary image:", err.message);
            }
          }
          mergedImages.push({
            url: replaced.url,
            publicId: replaced.publicId,
          });
        } else if (existingImg) {
          mergedImages.push(existingImg);
        } else {
          mergedImages.push(null);
        }
      }

      //  Always update all fields (no fallback to undefined)
      updatedVariants.push({
        color: strOr(vMeta.color, oldVariant.color),
        price: numOr(vMeta.price, oldVariant.price, false),
        stock: numOr(vMeta.stock, oldVariant.stock, true),
        images: mergedImages.filter(Boolean),
      });
    }

    //  Delete removed variants (and their Cloudinary images)
    for (let i = variants.length; i < existingVariants.length; i++) {
      for (const img of existingVariants[i]?.images || []) {
        try {
          await cloudinary.uploader.destroy(img.publicId);
        } catch (err) {
          console.warn(" Failed to delete old image:", err.message);
        }
      }
    }

    //  Prevent duplicate colors
    const seenColors = new Set();
    for (const v of updatedVariants) {
      const c = v.color.toLowerCase();
      if (seenColors.has(c)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate color "${v.color}" not allowed.`,
        });
      }
      seenColors.add(c);
    }

    //  Save final product
    product.variants = updatedVariants;
    await product.save();
    await product.populate("category");

    res.json({
      success: true,
      message: " Product updated successfully",
      product,
    });
  } catch (err) {
    console.error(" Update Product Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating product",
      error: err.message,
    });
  }
};


export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, isDeleted: false });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    product.isDeleted = true;
    await product.save();

    res.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete product',
      error: error.message 
    });
  }
};


export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }
    res.status(200).json({
      message: "Image uploaded successfully",
      url: req.file.path,
      publicId: req.file.filename
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};


// Delete image from Cloudinary
export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Public ID is required' 
      });
    }

    await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete Image Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete image',
      error: error.message 
    });
  }
};

// Toggle product active status (block/unblock)
export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product || product.isDeleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      success: true,
      message: `Product has been ${product.isActive ? "unblocked (active)" : "blocked (inactive)"} successfully.`,
      isActive: product.isActive
    });
  } catch (error) {
    console.error("Toggle Product Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle product status" });
  }
};
