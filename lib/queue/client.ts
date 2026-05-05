import { prisma } from '../database/prisma';

/**
 * Outbox Pattern — Client de Cues (V2 Sovereign)
 * 
 * Totes les tasques asíncrones s'escriuen a la taula OutboxEvent.
 * El worker Python (ARQ) les processa via FOR UPDATE SKIP LOCKED.
 * 
 * Això substitueix BullMQ i garanteix:
 * - Zero pèrdues de dades (persistència a PostgreSQL)
 * - Exactly-once execution
 * - Resiliència en redeploys de Redis
 */
async function addToOutbox(topic: string, name: string, data: any) {
  return await prisma.outboxEvent.create({
    data: {
      topic,
      payload: { jobName: name, ...data },
      status: 'PENDING'
    }
  });
}

export const reportQueue = { 
  add: async (name: string, data: any, _opts?: any) => {
    console.log(`[Outbox] 📝 Cua REPORT: ${name}`);
    return addToOutbox('report-generation', name, data);
  }
};

export const videoQueue = { 
  add: async (name: string, data: any, _opts?: any) => {
    console.log(`[Outbox] 📝 Cua VIDEO: ${name}`);
    return addToOutbox('video-processing', name, data);
  }
};

export const packagerQueue = { 
  add: async (name: string, data: any, _opts?: any) => {
    console.log(`[Outbox] 📝 Cua PACKAGER: ${name}`);
    return addToOutbox('territorial-packaging', name, data);
  }
};
