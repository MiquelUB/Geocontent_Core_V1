'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudUpload, 
  CheckCircle2, 
  RefreshCw,
  AlertCircle 
} from 'lucide-react';
import { 
  checkPendingChanges, 
  queueTerritorialPackageAction, 
  getPackagingStatus 
} from '@/lib/actions/packager';

interface PublishChangesButtonProps {
  municipalityId: string;
}

export function PublishChangesButton({ municipalityId }: PublishChangesButtonProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'ERROR' | 'SUCCESS'>('IDLE');
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      // 1. Comprovar si hi ha canvis pendents
      const { hasChanges: pending } = await checkPendingChanges(municipalityId);
      setHasChanges(pending);

      // 2. Comprovar l'estat del worker
      const { status: currentStatus } = await getPackagingStatus(municipalityId);
      
      if (currentStatus === 'PROCESSING') {
        setStatus('PROCESSING');
      } else if (currentStatus === 'ERROR') {
        setStatus('ERROR');
      } else if (status === 'PROCESSING' && currentStatus === 'IDLE') {
        // Acaba de finalitzar amb èxit
        setStatus('SUCCESS');
        setHasChanges(false);
        setTimeout(() => setStatus('IDLE'), 5000);
      }
    } catch (err) {
      console.error("Error checking publishing status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [municipalityId, status]);

  // Initial check and Polling
  useEffect(() => {
    checkStatus();
    
    let interval: NodeJS.Timeout;
    if (status === 'PROCESSING') {
      interval = setInterval(checkStatus, 3000);
    } else {
      interval = setInterval(checkStatus, 30000); // Poll cada 30s si està idle
    }

    return () => clearInterval(interval);
  }, [checkStatus, status]);

  const handlePublish = async () => {
    if (status === 'PROCESSING' || (!hasChanges && status !== 'ERROR')) return;

    setStatus('PROCESSING');
    const res = await queueTerritorialPackageAction(municipalityId);
    
    if (!res.success) {
      setStatus('ERROR');
    }
  };

  if (isLoading && status === 'IDLE') return <div className="h-10 w-32 bg-gray-100 animate-pulse rounded-lg" />;

  const getButtonContent = () => {
    switch (status) {
      case 'PROCESSING':
        return (
          <>
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span>Generant Paquet...</span>
          </>
        );
      case 'SUCCESS':
        return (
          <>
            <CheckCircle2 className="w-5 h-5 mr-2 text-primary" />
            <span>Publicat correctament</span>
          </>
        );
      case 'ERROR':
        return (
          <>
            <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
            <span>Error. Reintenta</span>
          </>
        );
      default:
        return (
          <>
            <CloudUpload className="w-5 h-5 mr-2" />
            <span>{hasChanges ? 'Publicar Canvis Offline' : 'Tot actualitzat'}</span>
          </>
        );
    }
  };

  const isDisabled = !hasChanges && status === 'IDLE';

  return (
    <div className="flex flex-col items-end gap-2">
      <motion.button
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        onClick={handlePublish}
        disabled={isDisabled || status === 'PROCESSING'}
        className={`
          relative flex items-center px-4 py-2 rounded-xl font-medium transition-all duration-300
          ${isDisabled 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
            : 'bg-white text-gray-900 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200'}
          ${status === 'PROCESSING' ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}
          ${status === 'ERROR' ? 'bg-red-50 border-red-200 text-red-600' : ''}
          ${status === 'SUCCESS' ? 'bg-primary/10 border-primary/30 text-primary' : ''}
        `}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={status + (hasChanges ? '-changes' : '-nochanges')}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center"
          >
            {getButtonContent()}
          </motion.div>
        </AnimatePresence>
      </motion.button>
      
      {hasChanges && status === 'IDLE' && (
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] text-amber-600 font-medium uppercase tracking-wider flex items-center"
        >
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse" />
          Canvis pendents de sincronitzar amb l'App
        </motion.span>
      )}
    </div>
  );
}
