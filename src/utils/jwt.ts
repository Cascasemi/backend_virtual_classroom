import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

export function signAccess(payload: object) {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '15m' });
}

export function signRefresh(payload: object) {
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, ENV.JWT_SECRET);
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET);
}
