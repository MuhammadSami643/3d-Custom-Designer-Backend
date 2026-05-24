require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var mongoose = require('mongoose');

var apiRouter = require('./routes/api');

var app = express();

// =====================================
// ALLOW CORS FROM ANY ORIGIN/IP
// =====================================
app.use(cors({
  origin: true,
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// =====================================
// MIDDLEWARE
// =====================================
app.use(logger('dev'));

app.use(express.json());

app.use(express.urlencoded({
  extended: false
}));

app.use(cookieParser());

// =====================================
// STATIC FILES
// =====================================
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'public/uploads'))
);

// =====================================
// DATABASE
// =====================================
const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/custom-3d-builder';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((err) => {
    console.log('❌ MongoDB connection error:', err);
  });

// =====================================
// API ROUTES
// =====================================
app.use('/api', apiRouter);

// =====================================
// 404 HANDLER
// =====================================
app.use(function(req, res, next) {
  next(createError(404));
});

// =====================================
// ERROR HANDLER
// =====================================
app.use(function(err, req, res, next) {

  console.error('SERVER ERROR:', err);

  res.status(err.status || 500);

  res.json({
    success: false,
    error: err.message || 'Server Error'
  });
});

module.exports = app;