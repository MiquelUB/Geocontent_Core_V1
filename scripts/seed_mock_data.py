import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify_safe_to_seed():
    """Garanteix que no injectem dades falses en producció accidentalment."""
    if os.getenv("ALLOW_MOCK_SEED_DANGER") != "true":
        logger.error("Aturada de seguretat: ALLOW_MOCK_SEED_DANGER no està actiu.")
        sys.exit(1)

if __name__ == "__main__":
    verify_safe_to_seed()
    logger.info("Iniciant generació de Dummy Data (Fixtures)...")
    
    # TODO: Lògica d'injecció de dummy data aquí...
    # 1. Crear municipis dummy si cal (o referenciar els reals)
    # 2. Crear Contactes
    # 3. Crear Deals (Kanban)
    # 4. Crear Interaccions
    
    logger.info("Dummy data injectada correctament.")
