import express from 'express';
import cors from 'cors';
import { ApiResponse } from '@shared/types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: { status: 'healthy' },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;