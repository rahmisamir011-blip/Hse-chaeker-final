
export enum PpeType {
  HAIRNET = 'Hairnet',
  MASK = 'Mask',
  SUIT = 'Protective suit',
  GLOVES = 'Gloves',
  SHOES = 'Safety shoes',
}

export const PpeTypeArabic: Record<PpeType, string> = {
  [PpeType.HAIRNET]: 'غطاء الشعر (شارلوت)',
  [PpeType.MASK]: 'كمامة الوجه',
  [PpeType.SUIT]: 'البذلة الواقية',
  [PpeType.GLOVES]: 'قفازات اليدين',
  [PpeType.SHOES]: 'حذاء السلامة',
};

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PpeFinding {
  ppeItem: PpeType;
  compliant: boolean;
  reason: string;
  boundingBox: BoundingBox;
}

export interface AnalysisResult {
  findings: PpeFinding[];
  summary: string;
  overallCompliant: boolean;
}
