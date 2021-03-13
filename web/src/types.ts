export * from '../../server/src/shared/types';

export type CardType = 'Forwards' | 'Reversed' | string;
export type ViewContext =
  | 'reviewAnswer'
  | 'reviewQuestion'
  | 'clayoutQuestion'
  | 'clayoutAnswer'
  | 'previewQuestion'
  | 'previewAnswer';

export interface MyAnkiSetup extends ExternalMyAnkiSetup {
  cardType: CardType;
  context: ViewContext;
  isAnki: boolean;
}

export type AnkiPluginConfig = {
  enabled: boolean;
  note_type?: string;
  deck?: string;
  question_field?: string;
  notes_field?: string;
  answer_field?: string;
};
