import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import { cloudinary } from "../../config/cloudinary.js";
import fs from 'fs/promises';


// List products (with search and pagination)
export const listProducts = async (req, res) => {
  try {
    // --- Pagination & search setup ---
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const q = (req.query.q || "").trim();

    const filter = { isDeleted: false };

    // --- Search filter ---
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
      ];
    }

    // --- Pagination logic ---
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
    const skip = (page - 1) * limit;

    // --- Fetch paginated products ---
    const products = await Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // --- Render EJS with all needed data ---
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
    // Simple color list - adjust as needed
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
        // 🧠 DEBUG LOG: check if Cloudinary URLs are stored correctly
    // console.log("✅ Product image check:", products[0]?.variants?.[0]?.images);

    // 👇 Render EJS view instead of returning JSON
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

    // 🧠 Parse or normalize variants
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch (err) {
        console.error("❌ Failed to parse variants JSON:", err);
        variants = [];
      }
    }

    // 🧠 Handle images for each variant (CLOUDINARY mapped to schema)
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

    console.log("✅ Prepared variants before save:", JSON.stringify(variants, null, 2));

    // 🧩 Validation
    if (!name || !description || !brand || !category)
      return res.status(400).json({ message: "Missing required fields" });

    if (!variants || variants.length === 0)
      return res.status(400).json({ message: "At least one variant is required" });

    // ✅ Create and save product
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

    console.log("✅ Saved product variant images:", newProduct.variants[0]?.images);

    res.status(201).json({
      message: "Product added successfully",
      product: newProduct
    });
  } catch (error) {
    console.error("❌ Add product error:", error);
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



// export const updateProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, description, brand, category, variants } = req.body;

//     const product = await Product.findOne({ _id: id, isDeleted: false });
    
//     if (!product) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'Product not found' 
//       });
//     }
//       if(product.stock>100){
//     console.log("It is not validate ")
//   }

//     // Validate category if provided
//     if (category) {
//       const categoryDoc = await Category.findById(category);
//       if (!categoryDoc) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Category not found' 
//         });
//       }
      
//       if (categoryDoc.isBlocked) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'This category is blocked and cannot be used' 
//         });
//       }
//     }

//     // Validate variants if provided
//     if (variants) {
//       if (!Array.isArray(variants) || variants.length === 0) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'At least one variant is required' 
//         });
//       }

//       for (let i = 0; i < variants.length; i++) {
//         const variant = variants[i];
        
//         if (variant.color && !variant.color.trim()) {
//           return res.status(400).json({ 
//             success: false, 
//             message: `Variant ${i + 1}: Color cannot be empty` 
//           });
//         }

//         if (variant.price !== undefined) {
//           const price = parseFloat(variant.price);
//           if (isNaN(price) || price < 0) {
//             return res.status(400).json({ 
//               success: false, 
//               message: `Variant ${i + 1}: Price must be a positive number` 
//             });
//           }
//         }

//         if (variant.stock !== undefined) {
//           const stock = parseInt(variant.stock);
//           if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
//             return res.status(400).json({ 
//               success: false, 
//               message: `Variant ${i + 1}: Stock must be a positive integer` 
//             });
//           }
//         }

//         if (variant.images && variant.images.length < 3) {
//           return res.status(400).json({ 
//             success: false, 
//             message: `Variant ${i + 1}: At least 3 images are required` 
//           });
//         }
//       }
//     }

//     // Update fields
//     if (name?.trim()) product.name = name.trim();
//     if (description?.trim()) product.description = description.trim();
//     if (brand?.trim()) product.brand = brand.trim();
//     if (category) product.category = category;

//     // 🧹 CLEANUP OLD CLOUDINARY IMAGES (if replaced)
// if (product.variants && product.variants.length > 0) {
//   for (const oldVariant of product.variants) {
//     for (const oldImage of oldVariant.images) {
//       // If this image's publicId is NOT in the new variants list, delete it from Cloudinary
//       const isStillUsed = Array.isArray(variants)
//         && variants.some(v =>
//           Array.isArray(v.images) &&
//           v.images.some(img => img.publicId === oldImage.publicId)
//         );

//       if (!isStillUsed) {
//         try {
//           await cloudinary.uploader.destroy(oldImage.publicId);
//           console.log(`🗑️ Deleted old Cloudinary image: ${oldImage.publicId}`);
//         } catch (err) {
//           console.error('❌ Failed to delete old image from Cloudinary:', err.message);
//         }
//       }
//     }
//   }
// }

//     if (variants) {
//       product.variants = variants.map(v => {
//   const existingVariant = product.variants.find(pv => pv.color === v.color);
//   return {
//     color: v.color?.trim() || v.color,
//     price: v.price ? parseFloat(v.price) : 0,
//     stock: v.stock ? parseInt(v.stock) : 0,
//     // 🧠 Keep existing images if not replaced
//     images: Array.isArray(v.images) && v.images.length > 0
//       ? v.images.map(i => ({ url: i.url, publicId: i.publicId }))
//       : existingVariant?.images || []
//   };
// });
//     }

//     await product.save();
//     await product.populate('category');

//     res.json({ 
//       success: true, 
//       message: 'Product updated successfully', 
//       product 
//     });
//   } catch (error) {
//     console.error('Update Product Error:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to update product',
//       error: error.message 
//     });
//   }
// };

// Soft delete product


/* ===========================
   🧰 UPDATE PRODUCT
   =========================== */
// export const updateProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     let { name, description, brand, category, variants } = req.body;

//     const product = await Product.findOne({ _id: id, isDeleted: false });
//     if (!product) return res.status(404).json({ success: false, message: "Product not found" });

//     if (typeof variants === "string") {
//       try {
//         variants = JSON.parse(variants);
//       } catch {
//         variants = [];
//       }
//     }

//     if (!Array.isArray(variants) || variants.length === 0) {
//       return res.status(400).json({ message: "At least one variant is required" });
//     }

//     // ✅ Map new images to variants
//     if (req.files && req.files.length > 0) {
//       variants = await Promise.all(
//         variants.map(async (variant, index) => {
//           const newImages = req.files
//             .filter((f) => f.originalname.startsWith(`variant${index}_`))
//             .map((f) => ({
//               url: f.path,
//               publicId: f.filename,
//             }));

//           if (newImages.length > 0 && product.variants[index]?.images?.length) {
//             for (const oldImg of product.variants[index].images) {
//               try {
//                 await cloudinary.uploader.destroy(oldImg.publicId);
//               } catch (err) {
//                 console.warn("Failed to delete:", oldImg.publicId, err.message);
//               }
//             }
//           }

//           return {
//             color: variant.color?.trim(),
//             price: parseFloat(variant.price),
//             stock: parseInt(variant.stock),
//             images: newImages.length > 0 ? newImages : product.variants[index]?.images || [],
//           };
//         })
//       );
//     } else {
//       variants = variants.map((variant, index) => ({
//         color: variant.color?.trim(),
//         price: parseFloat(variant.price),
//         stock: parseInt(variant.stock),
//         images: product.variants[index]?.images || [],
//       }));
//     }

//     product.name = name?.trim() || product.name;
//     product.description = description?.trim() || product.description;
//     product.brand = brand?.trim() || product.brand;
//     if (category) product.category = category;
//     product.variants = variants;

//     await product.save();
//     await product.populate("category");

//     res.json({ success: true, message: "Product updated successfully", product });
//   } catch (error) {
//     console.error("❌ Update Product Error:", error);
//     res.status(500).json({ message: "Failed to update product", error: error.message });
//   }
// };


/* ===========================
   ✅ UPDATE PRODUCT — Fixed Version
   =========================== */

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, description, brand, category, variants } = req.body;

    // Parse variants safely
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch {
        variants = [];
      }
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ======================
    // 1️⃣ UPDATE BASIC DETAILS
    // ======================
    product.name = name?.trim() || product.name;
    product.description = description?.trim() || product.description;
    product.brand = brand?.trim() || product.brand;
    if (category) product.category = category;

    // ======================
    // 2️⃣ UPDATE VARIANTS (Dynamic slot merge)
    // ======================
    const updatedVariants = [];

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const oldVariant = product.variants[i];
      if (!oldVariant) continue;

      // ✅ Find uploaded images for this variant
      const uploadedImages = (req.files || [])
        .filter((file) => file.originalname.startsWith(`variant${i}_slot`))
        .map((file) => ({
          url: file.path,
          publicId: file.filename,
          slot: parseInt(file.originalname.match(/slot(\d+)/)?.[1] || 0, 10),
        }));

      // ✅ Determine image count dynamically
      const totalSlots = Math.max(
        oldVariant.images?.length || 0,
        ...uploadedImages.map((img) => img.slot + 1),
        3 // at least 3 slots always
      );

      const newImages = [];

      for (let slot = 0; slot < totalSlots; slot++) {
        const existingImg = oldVariant.images?.[slot];
        const replacedImg = uploadedImages.find((img) => img.slot === slot);

        if (replacedImg) {
          // 🧹 Delete the old image in Cloudinary if being replaced
          if (existingImg?.publicId) {
            try {
              await cloudinary.uploader.destroy(existingImg.publicId);
              console.log(`🗑️ Deleted old image: ${existingImg.publicId}`);
            } catch (err) {
              console.warn("⚠️ Failed to delete old image:", err.message);
            }
          }

          // ✅ Add the new uploaded image
          newImages.push({
            url: replacedImg.url,
            publicId: replacedImg.publicId,
          });
        } else if (existingImg) {
          // ✅ Keep old image
          newImages.push(existingImg);
        } else {
          // ✅ Empty slot (preserve placeholder)
          newImages.push(null);
        }
      }

      // ✅ Final merged variant
      updatedVariants.push({
        color: variant.color?.trim() || oldVariant.color,
        price: parseFloat(variant.price || oldVariant.price),
        stock: parseInt(variant.stock || oldVariant.stock),
        images: newImages, // don’t filter — keep slot indexes stable
      });
    }

    product.variants = updatedVariants;
    await product.save();
    await product.populate("category");

    res.json({
      success: true,
      message: "✅ Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("❌ Update Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
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
