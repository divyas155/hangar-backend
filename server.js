const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('./config/passport');

// Load environment variables from .env
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport for OAuth
app.use(passport.initialize());

// OAuth2 callback endpoint (Google OAuth)
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  console.log('\n🎉 OAuth code received from Google:', code, '\n');
  res.send(
    '<h1>✔️ Google OAuth Success</h1>' +
    '<p>Check the terminal for the code. You can now close this tab.</p>'
  );
});

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Route handlers
const authRouter        = require('./routes/auth');
const usersRouter       = require('./routes/users');
const progressRouter    = require('./routes/progress');
const paymentsRouter    = require('./routes/payments');
const scopeRouter       = require('./routes/scope');
const testReportsRouter = require('./routes/testReports');
const commentsRouter    = require('./routes/comments'); // ✅ add centralized comment route

app.use('/api/auth',         authRouter);
app.use('/api/users',        usersRouter);
app.use('/api/progress',     progressRouter);
app.use('/api/payments',     paymentsRouter);
app.use('/api/scope',        scopeRouter);
app.use('/api/test-reports', testReportsRouter);
app.use('/api/comments',     commentsRouter); // ✅ mounted correctly

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
