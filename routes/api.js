const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const User = require('../models/User');
const Design = require('../models/Design');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// Create standard local storage engine for Multer local upload fallback
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB Limit
});

// Configure Cloudinary if credentials exist in env
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Fallback in-memory database arrays if MongoDB is offline
const memoryDb = {
  users: [],
  designs: [],
  orders: [],
  products: [
    {
      id: 'jersey',
      name: 'JUICE Sublimated Jersey',
      category: 'jerseys',
      productType: 'jersey',
      basePrice: 59.99,
      modelPath: '/shirt_baked.glb',
      zones: [
        { id: 'body', name: 'Body Panel' },
        { id: 'sleeves', name: 'Sleeves' },
        { id: 'collar', name: 'Collar & Trim' }
      ],
      defaultColors: {
        body: '#1E3A8A',
        sleeves: '#BE123C',
        collar: '#F59E0B'
      }
    },
    {
      id: 'cap',
      name: 'Pro-Stitch Baseball Cap',
      category: 'caps',
      productType: 'cap',
      basePrice: 24.99,
      modelPath: 'procedural',
      zones: [
        { id: 'crown', name: 'Crown Panels' },
        { id: 'visor', name: 'Visor / Brim' },
        { id: 'button', name: 'Top Button' },
        { id: 'eyelets', name: 'Eyelets' }
      ],
      defaultColors: {
        crown: '#1E3A8A',
        visor: '#BE123C',
        button: '#111827',
        eyelets: '#F59E0B'
      }
    }
  ]
};

// JWT Sign helper
const generateToken = (id) => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'antigravity_secret_jwt_key_2026_sports_3d_builder', 
    { expiresIn: '30d' }
  );
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function mongooseConnected() {
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
}

async function getUserIdFromToken(authHeader) {
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'antigravity_secret_jwt_key_2026_sports_3d_builder');
    return decoded.id;
  } catch (err) {
    return null;
  }
}

// ==========================================
// AUTH ROUTERS
// ==========================================

// @route   POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (mongooseConnected()) {
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = await User.create({ username, email, password });
      return res.status(201).json({
        user: { _id: user._id, username: user.username, email: user.email },
        token: generateToken(user._id)
      });
    } else {
      const userExists = memoryDb.users.find(u => u.email === email);
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = {
        _id: 'mem_user_' + Math.random().toString(36).substr(2, 9),
        username,
        email,
        password: hashedPassword,
        createdAt: new Date()
      };

      memoryDb.users.push(newUser);
      return res.status(201).json({
        user: { _id: newUser._id, username: newUser.username, email: newUser.email },
        token: generateToken(newUser._id)
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server registration error' });
  }
});

// @route   POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (mongooseConnected()) {
      const user = await User.findOne({ email }).select('+password');
      if (user && (await user.matchPassword(password))) {
        return res.json({
          user: { _id: user._id, username: user.username, email: user.email },
          token: generateToken(user._id)
        });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      const user = memoryDb.users.find(u => u.email === email);
      if (user && (await bcrypt.compare(password, user.password))) {
        return res.json({
          user: { _id: user._id, username: user.username, email: user.email },
          token: generateToken(user._id)
        });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server login error' });
  }
});

// @route   GET /api/auth/me
router.get('/auth/me', protect, async (req, res) => {
  res.json(req.user);
});

// ==========================================
// PRODUCT CATALOGUE ROUTERS
// ==========================================

async function seedDefaultProducts() {
  if (mongooseConnected()) {
    try {
      const count = await Product.countDocuments();
      if (count === 0) {
        console.log('Seeding default products to MongoDB database...');
        await Product.create(memoryDb.products);
        console.log('Successfully seeded default products.');
      }
    } catch (err) {
      console.error('Failed to seed default products to MongoDB:', err);
    }
  }
}

// @route   GET /api/products
router.get('/products', async (req, res) => {
  try {
    if (mongooseConnected()) {
      await seedDefaultProducts();
      const products = await Product.find({});
      res.json(products);
    } else {
      res.json(memoryDb.products);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving products catalogue' });
  }
});

// @route   GET /api/products/:id
router.get('/products/:id', async (req, res) => {
  try {
    if (mongooseConnected()) {
      await seedDefaultProducts();
      const product = await Product.findOne({ id: req.params.id });
      if (!product) return res.status(404).json({ message: 'Product not found' });
      res.json(product);
    } else {
      const product = memoryDb.products.find(p => p.id === req.params.id);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      res.json(product);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving product details' });
  }
});

// @route   PUT /api/products/:id
router.put('/products/:id', async (req, res) => {
  const { basePrice, name, defaultColors } = req.body;
  try {
    if (mongooseConnected()) {
      const product = await Product.findOne({ id: req.params.id });
      if (!product) return res.status(404).json({ message: 'Product not found' });
      
      if (basePrice !== undefined) product.basePrice = basePrice;
      if (name !== undefined) product.name = name;
      if (defaultColors !== undefined) product.defaultColors = defaultColors;
      
      const updated = await product.save();
      res.json(updated);
    } else {
      const idx = memoryDb.products.findIndex(p => p.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Product not found' });
      
      if (basePrice !== undefined) memoryDb.products[idx].basePrice = basePrice;
      if (name !== undefined) memoryDb.products[idx].name = name;
      if (defaultColors !== undefined) memoryDb.products[idx].defaultColors = defaultColors;
      
      res.json(memoryDb.products[idx]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating product' });
  }
});

// ==========================================
// DESIGN CRUD ROUTERS
// ==========================================

// @route   POST /api/designs
router.post('/designs', protect, async (req, res) => {
  try {
    if (mongooseConnected()) {
      const design = new Design({
        ...req.body,
        user: req.user._id
      });
      const saved = await design.save();
      res.status(201).json(saved);
    } else {
      const newDesign = {
        _id: 'mem_design_' + Math.random().toString(36).substr(2, 9),
        ...req.body,
        user: req.user._id,
        createdAt: new Date()
      };
      memoryDb.designs.push(newDesign);
      res.status(201).json(newDesign);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not save design' });
  }
});

// @route   GET /api/designs
router.get('/designs', protect, async (req, res) => {
  try {
    if (mongooseConnected()) {
      const designs = await Design.find({ user: req.user._id }).sort({ updatedAt: -1 });
      res.json(designs);
    } else {
      const designs = memoryDb.designs.filter(d => String(d.user) === String(req.user._id));
      res.json(designs);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not retrieve designs' });
  }
});

// @route   GET /api/designs/:id
router.get('/designs/:id', async (req, res) => {
  try {
    if (mongooseConnected()) {
      const design = await Design.findById(req.params.id);
      if (!design) return res.status(404).json({ message: 'Design not found' });
      res.json(design);
    } else {
      const design = memoryDb.designs.find(d => d._id === req.params.id);
      if (!design) return res.status(404).json({ message: 'Design not found' });
      res.json(design);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving design' });
  }
});

// @route   PUT /api/designs/:id
router.put('/designs/:id', protect, async (req, res) => {
  try {
    if (mongooseConnected()) {
      const design = await Design.findById(req.params.id);
      if (!design) return res.status(404).json({ message: 'Design not found' });
      if (String(design.user) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized to modify this design' });
      }

      Object.assign(design, req.body);
      const updated = await design.save();
      res.json(updated);
    } else {
      const idx = memoryDb.designs.findIndex(d => d._id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Design not found' });
      if (String(memoryDb.designs[idx].user) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized to modify this design' });
      }

      memoryDb.designs[idx] = {
        ...memoryDb.designs[idx],
        ...req.body,
        updatedAt: new Date()
      };
      res.json(memoryDb.designs[idx]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating design' });
  }
});

// @route   DELETE /api/designs/:id
router.delete('/designs/:id', protect, async (req, res) => {
  try {
    if (mongooseConnected()) {
      const design = await Design.findById(req.params.id);
      if (!design) return res.status(404).json({ message: 'Design not found' });
      if (String(design.user) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized to delete this design' });
      }

      await design.deleteOne();
      res.json({ message: 'Design deleted successfully' });
    } else {
      const idx = memoryDb.designs.findIndex(d => d._id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Design not found' });
      if (String(memoryDb.designs[idx].user) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized to delete this design' });
      }

      memoryDb.designs.splice(idx, 1);
      res.json({ message: 'Design deleted successfully' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting design' });
  }
});

// ==========================================
// UPLOADS ROUTER
// ==========================================

// @route   POST /api/uploads
router.post('/uploads', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an image file' });
  }

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'antigravity_3d_customizer'
      });
      fs.unlinkSync(req.file.path);
      return res.json({ url: result.secure_url });
    } catch (err) {
      console.warn('Cloudinary upload failed, using local fallback path:', err);
    }
  }

  const relativeUrl = `http://localhost:5000/uploads/${req.file.filename}`;
  res.json({ url: relativeUrl });
});

// ==========================================
// ORDERS / QUOTES ROUTERS
// ==========================================

// @route   POST /api/orders
router.post('/orders', async (req, res) => {
  console.log('=== ORDER SUBMISSION RECEIVED ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const { designId, contactDetails, designDetails, roster } = req.body;

  // Validate required fields
  if (!designId) {
    console.log('Missing designId');
    return res.status(400).json({ message: 'designId is required' });
  }
  
  if (!contactDetails) {
    console.log('Missing contactDetails');
    return res.status(400).json({ message: 'contactDetails are required' });
  }
  
  if (!contactDetails.name || !contactDetails.email || !contactDetails.phone || !contactDetails.teamName) {
    console.log('Missing required contact fields');
    return res.status(400).json({ 
      message: 'Contact details must include name, email, phone, and teamName' 
    });
  }
  
  if (!designDetails || !designDetails.productType) {
    console.log('Missing designDetails or productType');
    return res.status(400).json({ 
      message: 'designDetails with productType is required' 
    });
  }

  try {
    let savedOrder;
    const isMongoConnected = mongooseConnected();
    console.log('MongoDB connected:', isMongoConnected);
    
    if (isMongoConnected) {
      console.log('Attempting to save to MongoDB...');
      
      const orderData = {
        designId: designId,
        contactDetails: {
          name: contactDetails.name,
          email: contactDetails.email,
          phone: contactDetails.phone,
          teamName: contactDetails.teamName,
          notes: contactDetails.notes || ''
        },
        designDetails: {
          productType: designDetails.productType,
          colors: designDetails.colors || {},
          pattern: designDetails.pattern || '',
          logoUrl: designDetails.logoUrl || '',
          customText: designDetails.customText || '',
          textNumber: designDetails.textNumber || '',
          textColor: designDetails.textColor || '',
          textFont: designDetails.textFont || ''
        },
        roster: roster || [],
        user: req.headers.authorization ? await getUserIdFromToken(req.headers.authorization) : null,
        status: 'Pending Review'
      };
      
      console.log('Formatted order data:', JSON.stringify(orderData, null, 2));
      
      const order = new Order(orderData);
      savedOrder = await order.save();
      console.log('✅ Order saved to MongoDB with ID:', savedOrder._id);
      
    } else {
      console.log('⚠️ MongoDB not connected, using memory fallback...');
      savedOrder = {
        _id: 'mem_order_' + Math.floor(100000 + Math.random() * 900000),
        designId: designId,
        contactDetails: {
          name: contactDetails.name,
          email: contactDetails.email,
          phone: contactDetails.phone,
          teamName: contactDetails.teamName,
          notes: contactDetails.notes || ''
        },
        designDetails: {
          productType: designDetails.productType,
          colors: designDetails.colors || {},
          pattern: designDetails.pattern || '',
          logoUrl: designDetails.logoUrl || '',
          customText: designDetails.customText || '',
          textNumber: designDetails.textNumber || '',
          textColor: designDetails.textColor || '',
          textFont: designDetails.textFont || ''
        },
        roster: roster || [],
        user: req.headers.authorization ? await getUserIdFromToken(req.headers.authorization) : null,
        status: 'Pending Review',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryDb.orders.push(savedOrder);
      console.log('✅ Order saved to memory with ID:', savedOrder._id);
      console.log('Total orders in memory:', memoryDb.orders.length);
    }

    console.log('=== ORDER SUBMISSION COMPLETE ===');
    
    res.status(201).json({ 
      success: true,
      order: savedOrder,
      message: 'Quote request submitted successfully'
    });
    
  } catch (err) {
    console.error('=== ORDER SUBMISSION ERROR ===');
    console.error('Error details:', err);
    console.error('Error message:', err.message);
    
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Could not process quote request',
      error: err.message 
    });
  }
});

// @route   GET /api/orders
router.get('/orders', async (req, res) => {
  try {
    let filter = {};
    if (req.headers.authorization) {
      const userId = await getUserIdFromToken(req.headers.authorization);
      if (userId) filter.user = userId;
    }

    if (mongooseConnected()) {
      const orders = await Order.find(filter).sort({ createdAt: -1 });
      console.log(`Found ${orders.length} orders in MongoDB`);
      res.json(orders);
    } else {
      let orders = memoryDb.orders;
      if (filter.user) {
        orders = memoryDb.orders.filter(o => String(o.user) === String(filter.user));
      }
      console.log(`Found ${orders.length} orders in memory`);
      res.json(orders);
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Error fetching quote history' });
  }
});

// @route   GET /api/orders/:id
router.get('/orders/:id', async (req, res) => {
  try {
    if (mongooseConnected()) {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      res.json(order);
    } else {
      const order = memoryDb.orders.find(o => o._id === req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      res.json(order);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching order' });
  }
});

// @route   PUT /api/orders/:id
router.put('/orders/:id', async (req, res) => {
  const { status, adminNotes } = req.body;
  try {
    if (mongooseConnected()) {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      
      if (status !== undefined) order.status = status;
      if (adminNotes !== undefined) {
        if (!order.contactDetails) order.contactDetails = {};
        order.contactDetails.notes = adminNotes;
      }
      
      const updated = await order.save();
      res.json(updated);
    } else {
      const idx = memoryDb.orders.findIndex(o => String(o._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ message: 'Order not found' });
      
      if (status !== undefined) memoryDb.orders[idx].status = status;
      if (adminNotes !== undefined) {
        if (!memoryDb.orders[idx].contactDetails) memoryDb.orders[idx].contactDetails = {};
        memoryDb.orders[idx].contactDetails.notes = adminNotes;
      }
      
      res.json(memoryDb.orders[idx]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating order' });
  }
});

// @route   DELETE /api/orders/:id
router.delete('/orders/:id', async (req, res) => {
  try {
    if (mongooseConnected()) {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      await order.deleteOne();
      res.json({ message: 'Order deleted successfully' });
    } else {
      const idx = memoryDb.orders.findIndex(o => String(o._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ message: 'Order not found' });
      memoryDb.orders.splice(idx, 1);
      res.json({ message: 'Order deleted successfully' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting order' });
  }
});

// ==========================================
// ADMIN ROUTERS
// ==========================================

// @route   GET /api/admin/users
router.get('/admin/users', async (req, res) => {
  try {
    if (mongooseConnected()) {
      const users = await User.find({}).select('-password').sort({ createdAt: -1 });
      res.json(users);
    } else {
      res.json(memoryDb.users);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving users list' });
  }
});

// @route   GET /api/admin/designs
router.get('/admin/designs', async (req, res) => {
  try {
    if (mongooseConnected()) {
      const designs = await Design.find({}).populate('user', 'username email').sort({ createdAt: -1 });
      res.json(designs);
    } else {
      const designs = memoryDb.designs.map(d => {
        const u = memoryDb.users.find(usr => String(usr._id) === String(d.user));
        return {
          ...d,
          user: u ? { username: u.username, email: u.email } : { username: 'Guest', email: 'guest@customizer.com' }
        };
      });
      res.json(designs);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving designs list' });
  }
});

// @route   GET /api/admin/orders
router.get('/admin/orders', async (req, res) => {
  try {
    if (mongooseConnected()) {
      const orders = await Order.find({}).populate('user', 'username email').sort({ createdAt: -1 });
      res.json(orders);
    } else {
      res.json(memoryDb.orders);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving orders list' });
  }
});

// Debug route to check database status
router.get('/debug/status', async (req, res) => {
  const isConnected = mongooseConnected();
  res.json({
    mongoConnected: isConnected,
    memoryOrders: memoryDb.orders.length,
    memoryUsers: memoryDb.users.length,
    memoryDesigns: memoryDb.designs.length
  });
});

module.exports = router;