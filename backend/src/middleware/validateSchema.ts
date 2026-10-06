import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

export function validateSchema(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({ params: req.params, body: req.body });
    if (!result.success) return res.status(400).json({ success: false, message: 'Validation failed', issues: result.error.issues });
    next();
  };
}

import { validateCreatePaymentRequest, validateVerifyPaymentRequest } from '../schemas/payment.ts';
export function validatePaymentRequest(type: 'create' | 'verify') {
  return (req: Request, res: Response, next: NextFunction) => {
    const { isValid, error } = (type === 'create' ? validateCreatePaymentRequest : validateVerifyPaymentRequest)(req);
    if (!isValid) return res.status(400).json({ success: false, message: 'Validation failed', error });
    next();
  };
}
