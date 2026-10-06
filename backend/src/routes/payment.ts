import express from 'express';
import { createPayment, verifyPayment, getTransactionHistory, refundPayment, getPaymentConfig } from '../controllers/Payment.ts';
import { authenticateUser } from '../controllers/Auth.ts';
import { validatePaymentRequest } from '../middleware/validateSchema.ts';

const router = express.Router();
router.get('/config', getPaymentConfig as express.RequestHandler);
router.use(authenticateUser as express.RequestHandler);
router.post('/create', validatePaymentRequest('create') as express.RequestHandler, createPayment as express.RequestHandler);
router.post('/verify', validatePaymentRequest('verify') as express.RequestHandler, verifyPayment as express.RequestHandler);
router.get('/history', getTransactionHistory as express.RequestHandler);
router.post('/refund', refundPayment as express.RequestHandler);
export default router;
