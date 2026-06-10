import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger, errorLogger } from './logger/middleware.js';
import { initDatabase } from './db/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(requestLogger);
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/v1', routes);

app.use(errorLogger);
app.use(errorHandler);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

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
