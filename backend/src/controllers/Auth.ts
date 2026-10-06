import { db } from "../db/index.ts";
import {usersTable as users, usersTable} from "../db/schema.ts"
import {and, eq} from "drizzle-orm";

import bcrypt from "bcrypt";
import jwt, { verify } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import {generateAccessToken, generateRefreshToken} from "../utils/generateToken.ts";
import { issueOtp, consumeOtp } from "../utils/otp.ts";
import { emailFailure } from '../utils/emailErrors.ts';

interface AuthenticatedRequest extends Request {
  user?: any;
}

const isDbUnavailableError = (error: unknown, depth = 0): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string; cause?: unknown };
  return (
    err.code === 'ENETUNREACH' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === '57P01' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('connect enetunreach')) ||
    (depth < 3 && isDbUnavailableError(err.cause, depth + 1))
  );
};



export const normalizeEmail = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const validEmail = (value: string): boolean => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;

// logic for SIGN UP
export const signUp = async (req: Request,res:Response) => {
    try{
   //fetch details
   const {name,password} = req.body ?? {};
   const email = normalizeEmail(req.body?.email);
   const cleanName = typeof name === 'string' ? name.trim() : '';
   if (!validEmail(email) || cleanName.length < 1 || cleanName.length > 100 || !validPassword(password)) {
     res.status(400).json({ success: false, message: 'Invalid name, email or password (8-72 bytes)' }); return;
   }
    // check if user has already signed up 
    const existingUser = await db.select().from(users).where(eq(users.email,email));

    if(existingUser.length > 0){
         res.status(400).json({
          success: false,
          message: "User already exists"  
        });
         return;
    };
    // if user doesn't exists hash the password
    const hashedPassword = await bcrypt.hash(password,10);
     
    // now create an entry in DB
   const newUser = await db.insert(users).values({
    name: cleanName,
    email,
    password: hashedPassword,
    verified: false ,
   }).returning();

   try { await issueOtp(email); }
   catch (error) { // Keep the pending account available for a later resend.
     res.status(503).json({ success: false, ...emailFailure(error), requiresVerification: true, user: { email } }); return;
   }
   //  response
    res.status(200).json({
      success: true,
      message: "User registered successfully.",
      user: {
        name: newUser[0].name,
        email: newUser[0].email,
        verified: false
      },
      requiresVerification: true
    });
    return;
   }catch(error){
         res.status(500).json({
           success: false,
           message: "Internal Server error"
        });return;
    }
}


// logic for LOGIN 
export const login = async (req: Request, res: Response) => {
    try{
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    
    if(!validEmail(email) || typeof password !== "string" || !password){
         res.status(400).json({
           success: false,
           message: "Fill the details properly",
        });
        return;
    }
    
    const user = await db.select().from(users).where(eq(users.email,email));
    if(!user.length){
        res.status(404).json({ message: "User not found" });
        return;
    }
    
    if (user[0].isBanned) { res.status(403).json({ success: false, message: "Account disabled" }); return; }
    const match = await bcrypt.compare(password,user[0].password);
    if(!match){
         res.status(401).json({
            success: false,
            message: "Invalid Credentials"
        });
        return;
    }
    
    if (!user[0].verified) { res.status(403).json({ success: false, message: "Verify your email before signing in", requiresVerification: true }); return; }
    const accessToken = generateAccessToken(user[0].id, user[0].email);
    const refreshToken = generateRefreshToken(user[0].id);

    await db.update(users).set({ refreshToken }).where(eq(users.id, user[0].id));

    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,  
    });return;

    }catch(error){

      if (isDbUnavailableError(error)) {
        res.status(503).json({
          success: false,
          message: "Database unavailable. Check backend DATABASE_URL or use a Supabase pooler IPv4 URL."
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal Server error"
     });return;
    }
} 

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!validEmail(email)) {
      res.status(400).json({ success: false, message: "Email is required" });
      return;
    }

    // Check if user exists with this email
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (user.length) await issueOtp(email);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email"
    });
    return;

  } catch (error) {

    res.status(500).json({ 
      success: false, 
      message: "Failed to process password reset request" 
    });
    return;
  }
};  

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { otp, newPassword } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);

    if (!validEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp) || !validPassword(newPassword)) {
      res.status(400).json({ 
        success: false, 
        message: "Email, OTP, and new password are required" 
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (!await consumeOtp(email, otp, async (tx) => {
      const changed = await tx.update(users).set({ password: hashedPassword, refreshToken: null }).where(eq(users.email, email)).returning({ id: users.id });
      if (!changed.length) throw new Error('User update failed');
    })) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      return;
    }

    res.status(200).json({ 
      success: true, 
      message: "Password has been reset successfully" 
    });
    return;

  } catch (error) {

    res.status(500).json({ 
      success: false, 
      message: "Failed to reset password" 
    });
    return;
  }
};

//  logic for refresh token

export const refreshToken = async(req: Request, res: Response): Promise<void> => {
    try {
        // fetch the token
        const { token } = req.body ?? {};
        
        // validate token presence
        if (typeof token !== 'string' || !token) {
            res.status(401).json({
                success: false,
                message: "Refresh token is required"
            });
            return;
        }

        if (!process.env.REFRESH_SECRET) {
            res.status(503).json({ success: false, message: 'Authentication service unavailable' }); return;
        }
        // verify the refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(token, process.env.REFRESH_SECRET);
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                res.status(401).json({
                    success: false,
                    message: "Refresh token has expired"
                });
                return;
            }
            
            res.status(403).json({
                success: false,
                message: "Invalid refresh token"
            });
            return;
        }

        // Fetch user from the database using the decoded ID
        const user = await db.select().from(users).where(eq(users.id, decoded.id));

        // Check if user exists
        if (!user.length) {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
            return;
        }

        if (user[0].isBanned || !user[0].verified) { res.status(403).json({ success: false, message: "Account unavailable" }); return; }

        // Check if the stored refresh token matches
        if (user[0].refreshToken !== token) {
            res.status(403).json({
                success: false,
                message: "Refresh token has been revoked"
            });
            return;
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(decoded.id, user[0].email);
        const newRefreshToken = generateRefreshToken(decoded.id);

        // Update refresh token in database
        const changed = await db.update(users)
            .set({ refreshToken: newRefreshToken })
            .where(and(eq(users.id, user[0].id), eq(users.refreshToken, token)))
            .returning({ id: users.id });
        if (!changed.length) { res.status(403).json({ success: false, message: 'Refresh token has been revoked' }); return; }

        // Send new tokens
        res.status(200).json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            message: "Tokens refreshed successfully"
        });
        return;

    } catch (error) {
        res.status(isDbUnavailableError(error) ? 503 : 500).json({
            success: false,
            message: "Internal Server Error"
        });
        return;
    }
};

  // logic for  logout
  export const logout = async (req: Request, res: Response): Promise<void>  => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
             res.status(400).json({ success: false, message: "Refresh token required" });
             return;
        }

        await db.update(users).set({ refreshToken: null }).where(eq(users.refreshToken, refreshToken));

         res.status(200).json({ success: true, message: "Logged out successfully" });
         return;

    } catch (error) {

         res.status(500).json({ success: false, message: "Internal Server Error" });
         return;
    }
};
// authenticated user

export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
                code: "TOKEN_MISSING"
            });
        }

        const token = authHeader.split(" ")[1];
        
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined");
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded || typeof decoded === 'string') {
                return res.status(401).json({
                    success: false,
                    message: "Invalid token",
                    code: "TOKEN_INVALID"
                });
            }

            const [user] = await db
                .select()
                .from(usersTable)
                .where(eq(usersTable.id, decoded.id))
                .limit(1);
            
            

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User no longer exists",
                    code: "USER_NOT_FOUND"
                });
            }

            if (!user.verified) return res.status(403).json({ success: false, message: "Email verification required", code: "EMAIL_UNVERIFIED" });
            if (user.isBanned) return res.status(403).json({ success: false, message: "Account disabled", code: "ACCOUNT_DISABLED" });

            req.user = {
                id: user.id,
                email: user.email,
                role: user.role,
                isAdmin: user.isAdmin
            };
            
            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    success: false,
                    message: "Token has expired",
                    code: "TOKEN_EXPIRED"
                });
            }
            throw error;
        }
    } catch (error) {
        if (!process.env.JWT_SECRET || isDbUnavailableError(error)) {
            return res.status(503).json({ success: false, message: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' });
        }
        return res.status(401).json({
            success: false,
            message: "Authentication failed",
            code: "AUTH_FAILED",
        });
    }
};

export const validateSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid session",
                code: "INVALID_SESSION"
            });
        }

        const [user] = await db
            .select({
                id: usersTable.id,
                email: usersTable.email,
                role: usersTable.role,
                isAdmin: usersTable.isAdmin,
                isEducator: usersTable.isEducator,
                name: usersTable.name,
                verified: usersTable.verified,
                pfp: usersTable.pfp,
                phone: usersTable.phone
            })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
                code: "USER_INVALID"
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                isAdmin: user.isAdmin,
                isEducator: user.isEducator,
                name: user.name,
                verified: user.verified,
                pfp: user.pfp,
                phone: user.phone
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Session validation failed",
            code: "VALIDATION_ERROR"
        });
    }
};
