const mongoose = require('mongoose');

const DesignSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please provide a design name'],
    trim: true
  },
  productType: {
    type: String,
    required: true,
    enum: ['jersey', 'cap']
  },
  colors: {
    type: Map,
    of: String,
    required: true
  },
  pattern: {
    type: String,
    default: 'solid'
  },
  logoUrl: {
    type: String,
    default: null
  },
  logoScale: {
    type: Number,
    default: 0.15
  },
  logoPosition: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0.05 }
  },
  customText: {
    type: String,
    default: ''
  },
  textNumber: {
    type: String,
    default: ''
  },
  textColor: {
    type: String,
    default: '#FFFFFF'
  },
  textFont: {
    type: String,
    default: 'varsity'
  },
  textScale: {
    type: Number,
    default: 0.15
  },
  textPosition: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: -0.1 }
  },
  roster: [
    {
      name: String,
      number: String,
      size: String,
      quantity: { type: Number, default: 1 }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Design', DesignSchema);
