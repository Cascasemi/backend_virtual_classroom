import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_fallback_secret';

export function encodeGoogleState(payload: { uid: string; redirect?: string }) {
  return jwt.sign(payload, SECRET, { expiresIn: '10m' });
}

export function decodeGoogleState(token: string): { uid: string; redirect?: string } {
  return jwt.verify(token, SECRET) as any;
}
