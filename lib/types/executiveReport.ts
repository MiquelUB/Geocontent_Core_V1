export type FiabilitatKpi = 'baixa' | 'mitjana' | 'alta';

export interface KPIValue {
  valor: number | null;
  anterior: number | null;
  delta_abs: number | null;
  delta_pct: number | null;
  n: number;
  fiabilitat: FiabilitatKpi;
  disponible: boolean;
}

export type NivellDades = 'insuficient' | 'preliminar' | 'suficient';

export type ClientTipus = 'ajuntament' | 'museu' | 'associacio';

export type RutaSemafor = 'consolidada' | 'a_vigilar' | 'a_revisar' | 'sense_dades';

export type ComentariTipus = 'positiu' | 'negatiu' | 'documentacio_acces';

export interface ExecutiveReportInputData {
  client: {
    nom: string;
    tipus: ClientTipus;
  };
  periode: {
    inici: string; // dd/mm/aaaa
    final: string; // dd/mm/aaaa
    dies: number;
  };
  periode_anterior: {
    inici: string; // dd/mm/aaaa
    final: string; // dd/mm/aaaa
    disponible: boolean;
  };
  nivell_dades: NivellDades;
  kpis: {
    usuaris: {
      totals: KPIValue;
      nous: KPIValue;
      recurrents: KPIValue;
    };
    rutes: {
      completades: KPIValue;
      abandonades: KPIValue;
      taxa_abandonament: KPIValue;
    };
    temps: {
      mitja_per_ruta_min: KPIValue;
      mitja_per_poi_min: KPIValue;
    };
    quiz: {
      intents_mitjans: KPIValue;
      participacio_pct: KPIValue;
      distribucio_intents: { "1": number; "2": number; "3": number; "4": number };
    };
    valoracio: {
      global: KPIValue;
    };
    comentaris: {
      totals: KPIValue;
      positius: number;
      negatius: number;
      documentacio_acces: number;
    };
    dispositius: Array<{ model: string; n: number }>;
  };
  rutes: Array<{
    ruta_id: string;
    nom: string;
    activa: boolean;
    semafor: RutaSemafor;
    valoracio: {
      mitjana: number | null;
      n: number;
      historial: Array<{ data: string; mitjana: number; n: number }>;
    };
    completades: number;
    abandonades: number;
    temps_mitja_min: number | null;
    pois: Array<{
      poi_id: string;
      nom: string;
      ordre: number;
      desbloquejos: number;
      temps_mitja_min: number | null;
      quiz: {
        n: number;
        intents_mitjans: number | null;
        distribucio_intents: { "1": number; "2": number; "3": number; "4": number };
      };
    }>;
  }>;
  comentaris: Array<{
    id: string;
    ruta_id: string;
    tipus: ComentariTipus;
    data: string;
    text: string;
  }>;
  informe_anterior: {
    disponible: boolean;
    data: string;
    resum: string;
    propostes: Array<{ titol: string; ruta_id: string | null; poi_id: string | null }>;
  };
}

export type PalancaMillora =
  | 'contingut'
  | 'quiz'
  | 'estructura_ruta'
  | 'traduccions'
  | 'dates'
  | 'offline'
  | 'difusio_digital'
  | 'nova_ruta';

export interface ExecutiveReportOutputJson {
  resum_executiu: {
    titular: string;
    paragrafs: string[];
  };
  lectura_kpis: Array<{
    kpi: string;
    valor: string;
    canvi: string | null;
    estat: 'positiu' | 'neutre' | 'atencio' | 'no_valorable';
    fet: string;
    lectura: string;
    hipotesi: string | null;
    refs: string[];
  }>;
  rutes: Array<{
    ruta_id: string;
    nom: string;
    valoracio_text: string;
    evolucio: 'puja' | 'baixa' | 'estable' | 'sense_historial';
    lectura: string;
    refs: string[];
  }>;
  quiz: {
    lectura_global: string;
    pois_a_revisar: Array<{
      poi_id: string;
      nom: string;
      motiu: string;
      refs: string[];
    }>;
  };
  comentaris: {
    sensibilitat: string;
    temes: Array<{
      tipus: ComentariTipus;
      tema: string;
      n: number;
      cas_aillat: boolean;
    }>;
    citacions: string[];
  };
  ben_fet: Array<{
    tema: string;
    evidencia: string;
    refs: string[];
  }>;
  seguiment_anterior: Array<{
    proposta: string;
    estat_kpi: 'millora' | 'empitjora' | 'sense_canvi' | 'no_valorable';
    nota: string;
  }>;
  propostes: Array<{
    prioritat: number;
    titol: string;
    accio: string;
    palanca: PalancaMillora;
    on: {
      ruta_id: string | null;
      poi_id: string | null;
    };
    refs: string[];
    esforc: 'baix' | 'mitja' | 'alt';
    kpi_a_mirar: string;
  }>;
  grafiques: Array<{
    id: string;
    titular: string;
    lectura: string;
  }>;
  limitacions: string[];
}
