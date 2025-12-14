import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import { cloudinary } from "../../config/cloudinary.js";

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const listProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const q = (req.query.q || "").trim();

    const filter = { isDeleted: false };

  if (q) {
  const safeQuery = escapeRegex(q);

  filter.$or = [
    { name: { $regex: safeQuery, $options: "i" } },
    { brand: { $regex: safeQuery, $options: "i" } },
  ];
}


    /* =========================
       CARD COUNTS (DYNAMIC)
    ========================= */

    const totalProductsCount = await Product.countDocuments({ isDeleted: false });

    const activeProductsCount = await Product.countDocuments({
      isDeleted: false,
      isActive: true,
    });

    const allProducts = await Product.find({ isDeleted: false })
      .select("variants")
      .lean();

    let lowStockCount = 0;
    let outOfStockCount = 0;

    allProducts.forEach(p => {
      const totalStock = (p.variants || []).reduce(
        (sum, v) => sum + (v.stock || 0),
        0
      );

      if (totalStock === 0) outOfStockCount++;
      else if (totalStock < 10) lowStockCount++; 
    });

    /* =========================
       PAGINATED PRODUCT LIST
    ========================= */

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
      limit,

      totalProductsCount,
      activeProductsCount,
      lowStockCount,
      outOfStockCount
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

// Get active categories 
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

    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch (err) {
        console.error("Failed to parse variants JSON:", err);
        variants = [];
      }
    }


    if (Array.isArray(variants) && req.files?.length) {
      variants = variants.map((variant, index) => {
        const images = req.files
          .filter(f => f.originalname.startsWith(`variant${index}_`))
          .map(f => ({
            url: f.path,        
            publicId: f.filename 
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

    // if(variants.length>3){
    //   return res.status(400).json({
    //     success:false,
    //     message:"can't add roducts up to 3 varients"
    //   });
    // }


    const existingProduct=await Product.findOne({
      name:{$regex:`^${name.trim()}$`,$options:"i"} 
   
    })
    if(existingProduct){
      return res.status(400).json({
        message:"Product name alreday exists.Please choose a different name.",
        success:false
      });
    }
     
    if (!name || !description || !brand || !category)
      return res.status(400).json({ message: "Missing required fields" });

    if (!variants || variants.length === 0)
      return res.status(400).json({ message: "At least one variant is required" });

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

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    if (name && name.trim()) {
      const existingWithSameName = await Product.findOne({
        _id: { $ne: id }, 
        name: { $regex: `^${name.trim()}$`, $options: "i" }, 
        isDeleted: false
      });

      if (existingWithSameName) {
        return res.status(400).json({
          success: false,
          message: `Product name "${name}" already exists. Please choose a different name.`
        });
      }
    }

    
    product.name = strOr(name, product.name);
    product.description = strOr(description, product.description);
    product.brand = strOr(brand, product.brand);
    if (category) product.category = category;

 
    const updatedVariants = [];
    const existingVariants = product.variants || [];

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

      updatedVariants.push({
        color: strOr(vMeta.color, oldVariant.color),
        price: numOr(vMeta.price, oldVariant.price, false),
        stock: numOr(vMeta.stock, oldVariant.stock, true),
        images: mergedImages.filter(Boolean),
      });
    }

    for (let i = variants.length; i < existingVariants.length; i++) {
      for (const img of existingVariants[i]?.images || []) {
        try {
          await cloudinary.uploader.destroy(img.publicId);
        } catch (err) {
          console.warn(" Failed to delete old image:", err.message);
        }
      }
    }

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
