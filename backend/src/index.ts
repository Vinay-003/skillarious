import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import userRoutes from './routes/user.ts';
import authRoute from "./routes/auth.ts";
import otpRoute from "./routes/otp.ts";
import courseRoute from "./routes/course.ts";
import paymentRoute from "./routes/payment.ts";
import reviewRoute from "./routes/review.ts";
import educatorRoute from "./routes/educator.ts";
import contentRoute from "./routes/content.ts";
import fileUpload from 'express-fileupload';
import path from 'path';
// import { setupCategoryTriggers } from './db/setupTriggers.ts';

config();

// Add this near the start of your server initialization
console.log('Verifying Razorpay credentials:', {
    keyId: {
        exists: !!process.env.RAZORPAY_KEY_ID,
        length: process.env.RAZORPAY_KEY_ID?.length,
        prefix: process.env.RAZORPAY_KEY_ID?.substring(0, 8)
    },
    secret: {
        exists: !!process.env.RAZORPAY_SECRET,
        length: process.env.RAZORPAY_SECRET?.length
    }
});

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.use('/api/v1/users', userRoutes);
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/otp", otpRoute);
app.use("/api/v1/courses", courseRoute);
app.use("/api/v1/reviews", reviewRoute);
app.use("/api/v1/educators", educatorRoute);
app.use("/api/v1/content", contentRoute);

// Setup the trigger
//setupCategoryTriggers().catch(console.error);

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.NEXT_PUBLIC_FRONTEND_URL}`);
});





