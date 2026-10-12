import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());


app.use('/api/auth', authRoutes);

app.use('/api/upload', uploadRoutes);

export default app;