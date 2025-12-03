// quickTest.js
import mongoose from 'mongoose';
import Offer from './models/offerModel.js';
import Product from './models/productModel.js';
import './models/category.js'; // Import category model if needed

async function quickTest() {
  console.log('Starting quick test...\n');
  
  try {
    // Connect to your database
    await mongoose.connect('mongodb://localhost:27017/bagcart');
    console.log('✓ Connected to MongoDB');
    
    // Check if database exists
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n✓ Database collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Check offers collection
    const offerCount = await Offer.countDocuments();
    console.log(`\n✓ Offers in database: ${offerCount}`);
    
    if (offerCount > 0) {
      const offers = await Offer.find().limit(3).lean();
      console.log('\n✓ First 3 offers:');
      offers.forEach((offer, i) => {
        console.log(`  ${i+1}. ${offer.name}`);
        console.log(`     Type: ${offer.type}`);
        console.log(`     Discount: ${offer.discountValue}%`);
        console.log(`     Active: ${offer.isActive}`);
        console.log(`     Products: ${offer.products?.length || 0}`);
        console.log(`     Categories: ${offer.categories?.length || 0}`);
      });
    } else {
      console.log('\n✗ No offers found in database!');
    }
    
    // Check products collection
    const productCount = await Product.countDocuments();
    console.log(`\n✓ Products in database: ${productCount}`);
    
    if (productCount > 0) {
      const products = await Product.find().limit(3).populate('category').lean();
      console.log('\n✓ First 3 products:');
      products.forEach((product, i) => {
        console.log(`  ${i+1}. ${product.name}`);
        console.log(`     ID: ${product._id}`);
        console.log(`     Category: ${product.category?.name || 'None'}`);
        console.log(`     Category ID: ${product.category?._id || 'None'}`);
        console.log(`     Price: ₹${product.variants?.[0]?.price || 0}`);
        console.log(`     MRP: ₹${product.variants?.[0]?.mrp || product.variants?.[0]?.price || 0}`);
      });
    } else {
      console.log('\n✗ No products found in database!');
    }
    
    // Test with a specific product
    if (productCount > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('OFFER APPLICATION TEST:');
      console.log('='.repeat(60));
      
      const testProduct = await Product.findOne().populate('category').lean();
      console.log(`\nTest Product: ${testProduct.name}`);
      console.log(`Product ID: ${testProduct._id}`);
      console.log(`Category: ${testProduct.category?.name || 'None'}`);
      console.log(`Category ID: ${testProduct.category?._id || 'None'}`);
      
      const now = new Date();
      
      // Check product offers
      const productOffers = await Offer.find({
        type: 'product',
        products: testProduct._id,
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now }
      }).lean();
      
      console.log(`\nProduct Offers Found: ${productOffers.length}`);
      productOffers.forEach(offer => {
        console.log(`  - ${offer.name}: ${offer.discountValue}%`);
      });
      
      // Check category offers
      const categoryOffers = await Offer.find({
        type: 'category',
        categories: testProduct.category?._id,
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now }
      }).lean();
      
      console.log(`\nCategory Offers Found: ${categoryOffers.length}`);
      categoryOffers.forEach(offer => {
        console.log(`  - ${offer.name}: ${offer.discountValue}%`);
      });
      
      // Which should be selected?
      const allOffers = [...productOffers, ...categoryOffers];
      if (allOffers.length > 0) {
        const highestOffer = allOffers.sort((a, b) => b.discountValue - a.discountValue)[0];
        console.log(`\nHighest offer should be: ${highestOffer.name}`);
        console.log(`Type: ${highestOffer.type}`);
        console.log(`Discount: ${highestOffer.discountValue}%`);
      } else {
        console.log('\n✗ No applicable offers found for this product!');
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

quickTest();