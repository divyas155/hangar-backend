const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const passport = require('./config/passport'); // ✅ Retained for JWT or future strategies
const fileRoutes = require('./routes/file');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize()); // 🔐 Optional JWT/passport strategies

// ✅ Serve static assets (e.g., logo for PDF watermark)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ✅ MongoDB Connection with 24x7 reliability
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ API Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/progress',     require('./routes/progress'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/scope',        require('./routes/scope'));
app.use('/api/test-reports', require('./routes/testReports'));
app.use('/api/comments',     require('./routes/comments'));
app.use('/api/files',        fileRoutes);
app.use('/images',           express.static(path.join(__dirname, 'assets/images')));

// ✅ Root Health Check
app.get('/', (req, res) => {
  res.send('✅ My backend is running at iruvade.com');
});

// ❌ 404 Fallback Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ❗ Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!'
  });
});

// 🚀 Start Server (Cloud Run Compatible)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
