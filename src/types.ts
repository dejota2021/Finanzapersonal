export interface Partner {
  id: string;
  name: string;
  role: string;
  sharePercent: number; // e.g. 50
  color: string;
  avatarBg: string;
  phone?: string;
}

export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  destination: string; // Category or budget destination
  isDeductible: boolean;
  deductiblePercentage: number;
  paidBy: string; // Partner ID
  splitRatio: {
    [partnerId: string]: number;
  };
  date: string; // YYYY-MM-DD
  notes?: string;
  receiptUrl?: string;
  voiceRecorded?: boolean;
  createdAt: string;
  createdByName?: string;
}

export interface BudgetDestination {
  id: string;
  destination: string;
  monthlyLimit: number;
  color: string;
  iconName: string;
  description?: string;
}

export interface ProjectSettings {
  projectName: string;
  genreOrStyle: string;
  currency: string;
  currencySymbol: string;
  taxRatePercent: number;
  partners: [Partner, Partner];
  dailyBudget?: number;
}

export interface FinanceAttachment {
  id: string;
  name: string;
  size: number;
  type: string; // MIME type
  fileCategory: 'pdf' | 'spreadsheet' | 'document' | 'other';
  year?: number | null;
  month?: number | null; // 1-12
  scope: 'general' | 'year' | 'month';
  notes?: string;
  uploadedAt: string;
  uploadedBy?: string;
  dataUrl?: string; // Base64 data URL for download / preview
}

export interface ProjectFinanceState {
  settings: ProjectSettings;
  budgets: BudgetDestination[];
  transactions: Transaction[];
  attachments?: FinanceAttachment[];
  lastUpdated: string;
}

export interface SyncEvent {
  id: string;
  type:
    | 'TRANSACTION_ADDED'
    | 'TRANSACTION_UPDATED'
    | 'TRANSACTION_DELETED'
    | 'BUDGET_SAVED'
    | 'SETTINGS_UPDATED'
    | 'ATTACHMENT_ADDED'
    | 'ATTACHMENT_DELETED'
    | 'RESET_DATA'
    | 'USER_ONLINE_COUNT'
    | 'USER_JOINED';
  data: any;
  message: string;
  partnerName: string;
  timestamp: string;
}

export interface ParsedVoiceExpense {
  title: string;
  amount: number;
  type: TransactionType;
  destination: string;
  isDeductible: boolean;
  paidByPartnerId?: string;
  splitPartner1: number;
  splitPartner2: number;
  notes?: string;
  suggestedDestinations?: string[];
}
