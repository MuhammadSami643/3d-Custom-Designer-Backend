const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  designId: {
    type: String,
    required: true
  },
  contactDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    teamName: { type: String, required: true },
    notes: { type: String, default: '' }
  },
  designDetails: {
    productType: { type: String, required: true },
    colors: { type: Map, of: String },
    pattern: { type: String },
    logoUrl: { type: String },
    customText: { type: String },
    textNumber: { type: String },
    textColor: { type: String },
    textFont: { type: String }
  },
  roster: [
    {
      name: String,
      number: String,
      size: String,
      quantity: Number
    }
  ],
  status: {
    type: String,
    enum: ['Pending Review', 'Approved', 'Shipped', 'Cancelled'],
    default: 'Pending Review'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);