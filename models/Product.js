const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  basePrice: {
    type: Number,
    required: true
  },
  modelPath: {
    type: String,
    required: true
  },
  zones: [
    {
      id: { type: String, required: true },
      name: { type: String, required: true }
    }
  ],
  defaultColors: {
    type: Map,
    of: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
