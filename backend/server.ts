import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoute from "./src/routes/auth.ts";
import otpRoute from "./src/routes/otp.ts";
import courseRoute from "./src/routes/course.ts";
import paymentRoute from "./src/routes/payment.ts";
import reviewRoute from "./src/routes/review.ts";
import educatorRoute from "./src/routes/educator.ts";
import contentRoute from "./src/routes/content.ts";
import fileUpload from 'express-fileupload';
import userRoutes from "./src/routes/user.ts";
import studentRoute from "./src/routes/student.ts";
import cookieParser from "cookie-parser";
import path from 'path';

const app = express();
dotenv.config();

// CORS configuration
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/otp", otpRoute);
app.use("/api/v1/courses", courseRoute);
app.use("/api/v1/payments", paymentRoute);
app.use("/api/v1/reviews", reviewRoute);
app.use("/api/v1/educators", educatorRoute);
app.use("/api/v1/content", contentRoute);
app.use("/api/v1/student", studentRoute);

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

