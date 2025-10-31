import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be positive']
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: [0, 'Stock cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Stock must be an integer'
    }
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  }]
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  variants: {
    type: [productVariantSchema],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one variant is required'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
productSchema.index({ isDeleted: 1, createdAt: -1 });
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', brand: 'text' });

export default mongoose.model('Product', productSchema);