import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';

export interface AuthRequest extends Request { user?: any }

export function auth(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('Auth middleware called with roles:', roles);
    console.log('Request headers:', req.headers.authorization ? 'Bearer token present' : 'No authorization header');
    
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      console.log('No Bearer token found');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = header.split(' ')[1];
    try {
      const decoded: any = verifyAccess(token);
      console.log('Token decoded successfully for user:', decoded.email, 'role:', decoded.role);
      
      if (roles.length && !roles.includes(decoded.role)) {
        console.log('User role', decoded.role, 'not in required roles:', roles);
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      req.user = decoded;
      next();
    } catch (e) {
      console.log('Token verification failed:', e);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
