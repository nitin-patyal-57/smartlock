import { Request, Response, NextFunction } from 'express'

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check and dashboard reads
  if (req.path === '/health' || req.method === 'GET') {
    return next()
  }
  
  const apiKey = req.headers['x-api-key'] || req.query.apiKey
  const validKey = process.env.API_KEY || 'smartlock-dev-key-2024'
  
  if (apiKey === validKey) {
    return next()
  }
  
  res.status(401).json({ error: 'Invalid or missing API key' })
}
