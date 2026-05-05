import redis from './redis';

/**
 * Limitador de trànsit simple basat en Redis
 * @param key Identificador únic (ex: ip o email)
 * @param limit Màxim d'intents
 * @param windowSeconds Finestra de temps en segons
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const redisKey = `ratelimit:${key}`;
  
  const current = await redis.get(redisKey);
  const count = current ? parseInt(current) : 0;

  if (count >= limit) {
    return { success: false, remaining: 0 };
  }

  const multi = redis.multi();
  multi.incr(redisKey);
  
  if (count === 0) {
    multi.expire(redisKey, windowSeconds);
  }

  await multi.exec();

  return { 
    success: true, 
    remaining: limit - (count + 1) 
  };
}
