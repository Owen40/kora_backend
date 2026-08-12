const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./Routes/authRoutes');
const restaurantRoutes = require('./Routes/restaurantRoutes');
const categoryRoutes = require('./Routes/categoryRoutes');
const dishRoutes = require('./Routes/dishesRoutes');
const userRoutes = require('./Routes/userRoutes');
const addressRoutes = require('./Routes/addressRoutes');
const allergenRoutes = require('./Routes/allergenRoutes');

const app = express();
const PORT = process.env.PORT || 5070;

const allowedOrigins = [ 'https://kora.bmsdyna.live', 'http://localhost:3000', 'http://localhost:5173' ];

app.use(cors({ origin: allowedOrigins }));
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:  process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests form this IP, please try again later.'
});

app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Kora API is healthy',
    timestamp: new Date().toISOString()
  });
});

// The system routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dishes', dishRoutes);
app.use('/api/users', userRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/allergens', allergenRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? err.message : 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀Kora API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🔗 Health check available at /health`);
});

module.exports = app;