import { db } from "../db/index.ts";
import {usersTable as users, usersTable} from "../db/schema.ts"
import {eq} from "drizzle-orm";
import {config} from "dotenv";
import bcrypt from "bcrypt";
import jwt, { verify } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import {generateAccessToken, generateRefreshToken} from "../utils/generateToken.ts";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const isDbUnavailableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === 'ENETUNREACH' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === '57P01' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('connect enetunreach'))
  );
};

config({path: ".env.local"});

// Add a check at the start of your server initialization
if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables");
    process.exit(1);
}

// logic for SIGN UP
export const signUp = async (req: Request,res:Response) => {
    try{
   //fetch details
   const {name,email,password} = req.body as {name: string, email: string, password: string};
   //validate data
   if(!name || !email || !password){
     res.status(400).json({
        success: false,
        message: "Fill the details properly",
     });return;
     
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
    name,
    email,
    password: hashedPassword,
    verified: true ,
   }).returning();

   //  response
    res.status(200).json({
      success: true,
      message: "User registered successfully.",
      user: {
        name: newUser[0].name,
        email: newUser[0].email,
        verified: true
      },
      requiresVerification: false
    });
    return;
   }catch(error){
        console.log(error);
         res.status(500).json({
           success: false,
           message: "Internal Server error"
        });return;
    }
}


// logic for LOGIN 
export const login = async (req: Request, res: Response) => {
    try{
    const {email,password} = req.body;
    
    if(!email || !password){
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
    
    const match = await bcrypt.compare(password,user[0].password);
    if(!match){
         res.status(401).json({
            success: false,
            message: "Invalid Credentials"
        });
        return;
    }
    
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
     console.log(error);
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
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: "Email is required" });
      return;
    }

    // Check if user exists with this email
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user.length) {
      res.status(404).json({ 
        success: false, 
        message: "No account exists with this email address" 
      });
      return;
    }

    // Use the existing generateOtp endpoint
    const response = await fetch(`${process.env.HOST_URL}/api/v1/otp/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!data.success) {
      res.status(500).json({
        success: false,
        message: data.message || "Failed to send OTP"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email"
    });
    return;

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process password reset request" 
    });
    return;
  }
};  

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      res.status(400).json({ 
        success: false, 
        message: "Email, OTP, and new password are required" 
      });
      return;
    }

    // Verify OTP
    const response = await fetch(`${process.env.HOST_URL}/api/v1/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();
      
    if (!data.success) {
      res.status(400).json({
        success: false,
        message: data.message || 'Invalid or expired OTP'
      });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));

    res.status(200).json({ 
      success: true, 
      message: "Password has been reset successfully" 
    });
    return;

  } catch (error) {
    console.error('Reset password error:', error);
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
        const { token } = req.body;
        
        // validate token presence
        if (!token) {
            res.status(401).json({
                success: false,
                message: "Refresh token is required"
            });
            return;
        }

        // verify the refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(token, process.env.REFRESH_SECRET || "refresh_secret");
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

        // Check if the stored refresh token matches
        if (user[0].refreshToken !== token) {
            // Clear the invalid refresh token from database
            await db.update(users)
                .set({ refreshToken: null })
                .where(eq(users.id, user[0].id));

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
        await db.update(users)
            .set({ refreshToken: newRefreshToken })
            .where(eq(users.id, user[0].id));

        // Send new tokens
        res.status(200).json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            message: "Tokens refreshed successfully"
        });
        return;

    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).json({
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

        // Check if the token exists
        const user = await db.select().from(users).where(eq(users.refreshToken, refreshToken));
        if (!user.length) {
             res.status(404).json({ success: false, message: "User not found" });
             return;
        }

        // Remove refresh token from database
        await db.update(users).set({ refreshToken: null }).where(eq(users.id, user[0].id));

         res.status(200).json({ success: true, message: "Logged out successfully" });
         return;

    } catch (error) {
        console.error(error);
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

            // if (!user.isActive) {
            //     return res.status(401).json({
            //         success: false,
            //         message: "User account is disabled",
            //         code: "ACCOUNT_DISABLED"
            //     });
            // }

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
        return res.status(401).json({
            success: false,
            message: "Authentication failed",
            code: "AUTH_FAILED",
            error: error
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
                isEducator: usersTable.isEducator
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
                isEducator: user.isEducator
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
