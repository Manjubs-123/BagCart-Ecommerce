import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export const addVariants = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) return res.status(404).send("Product not found");

    const variantsData = [];

    for (let i = 0; i < req.body.variants.length; i++) {
      const files = req.files[`variants[${i}][images]`];

      let uploadedImages = [];
      if (files) {
        for (const file of files) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "BagCart/Products",
          });
          uploadedImages.push(result.secure_url);
          fs.unlinkSync(file.path); 
        }
      }

      variantsData.push({
        colour: v.colour,
        price: v.price,
        stock: v.stock,
        images: uploadedImages,
      });
    }

    product.variants.push(...variantsData);
    await product.save();

    res.send("Variants added successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding variants");
  }
};
