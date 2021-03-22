declare type ExternalMyAnkiSetup = {
  nextTerm?: string;
  currentTerm: string;
  context: any;
  cardType: any;
  tags: string[];
  isAnki: boolean;
  id: number;
  nextId?: number;
  extraLang?: string;
};

interface Window {
  myAnkiSetup?: ExternalMyAnkiSetup;
  myAnkiUpdate?: (data: ExternalMyAnkiSetup) => void;
}
