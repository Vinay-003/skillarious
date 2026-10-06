import { config } from 'dotenv';
config({ path: '.env.local' });
import { createApp } from './src/app.ts';

const port = Number(process.env.PORT || 4001);
createApp().listen(port, () => console.log(`Server running on port ${port}`));
