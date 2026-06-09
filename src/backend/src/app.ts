import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { initDatabase } from './db/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(requestId);

// Routes
app.use('/api/v1', routes);

// Error handling
app.use(errorHandler);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

// Initialize DB on startup, then start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default app;