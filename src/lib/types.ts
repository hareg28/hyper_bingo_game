export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  name: string;
  phone: string;
  telegramId: string;
  username: string;
  role: UserRole;
  status: AccountStatus;
  referralCode: string;
  referredBy?: string;
  createdAt: string;
}

export interface Wallet {
  userId: string;
  availableBalance: number; // ETB
  bonusBalance: number;     // ETB
  winningBalance: number;   // ETB
  totalDeposited: number;   // ETB
  totalWithdrawn: number;   // ETB
}

export type GameStatus = 'SCHEDULED' | 'OPEN' | 'STARTING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
export type GameType = 'QUICK_BINGO' | 'CLASSIC_75' | 'HIGH_STAKES' | 'TURBO_EXPRESS' | 'WEEKEND_LOTTERY';

export interface WinnerRecord {
  userId: string;
  username: string;
  pattern: string; // e.g. 'Line', 'Two Lines', 'Full House'
  prizeWon: number; // ETB
  claimedAt: string;
}

export interface Game {
  id: string;
  name: string;
  gameType: GameType;
  entryPrice: number;       // ETB
  minPlayers?: number;      // Required minimum players to start (e.g. 5 or 10)
  maxPlayers: number;
  currentPlayers: number;
  startTime: string;        // ISO string or timestamp countdown
  drawInterval: number;     // Seconds between drawn balls (e.g. 3s for Quick Bingo, 5s for Classic)
  prizePool: number;        // ETB
  status: GameStatus;
  drawnNumbers: number[];   // Array of numbers drawn so far (1..75)
  currentBall?: number;     // Active ball
  winners: WinnerRecord[];
  blockedCards?: string[];  // Array of blocked card numbers e.g. ['200']
  isWeekendSpecial?: boolean;
  createdAt: string;
}

export interface BingoCard {
  id: string;
  cardNumber: string;       // e.g. '12608', '11302'
  gameId: string;
  userId: string;
  // 5x5 Matrix of numbers (1..75 column based: B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
  // Center (2,2) is 0 representing FREE square
  numbers: number[][]; 
  marked: boolean[][]; // 5x5 boolean grid tracking marked daubs
  hasWonLine?: boolean;
  hasWonTwoLines?: boolean;
  hasWonFullHouse?: boolean;
}

export type TransactionType = 
  | 'DEPOSIT' 
  | 'WITHDRAWAL' 
  | 'GAME_ENTRY' 
  | 'GAME_WIN' 
  | 'REFERRAL_REWARD' 
  | 'PROMOTION_BONUS';

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'FAILED';
export type PaymentProvider = 'Telebirr' | 'CBE Birr' | 'Chapa' | 'Bank Transfer';

export interface Transaction {
  id: string;
  userId: string;
  username: string;
  type: TransactionType;
  amount: number; // Positive for additions, negative for deductions
  balanceAfter: number;
  reference: string;
  paymentProvider?: PaymentProvider;
  status: TransactionStatus;
  description: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  transactionId: string;
  userId: string;
  username: string;
  amount: number;
  paymentMethod: PaymentProvider;
  accountNumber: string;
  accountName: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  code: string;
  description: string;
  bonusPercentage: number;
  maxBonus: number;
  minDeposit: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  referredUserId: string;
  referredName: string;
  rewardAmount: number;
  status: 'PENDING' | 'REWARDED';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminUsername: string;
  action: string;
  target: string;
  amount?: number;
  ipAddress: string;
  timestamp: string;
}

// ── Telegram Auth ──────────────────────────────────────────────
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// ── Linked Bank / Payment Accounts ────────────────────────────
export type LinkedAccountType = 'TELEBIRR' | 'CBE_BIRR' | 'AWASH_BIRR' | 'BANK_TRANSFER';
export type LinkedAccountStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface LinkedPaymentAccount {
  id: string;
  userId: string;
  type: LinkedAccountType;
  accountNumber: string;   // Telebirr phone: +2519..., CBE: account number
  accountName: string;     // Full legal name registered on the account
  bankName?: string;       // For BANK_TRANSFER type
  status: LinkedAccountStatus;
  isDefault: boolean;
  createdAt: string;
}

// ── API Response Helpers ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DepositInitResponse {
  checkoutUrl: string;    // URL to redirect user to for payment
  txRef: string;          // Transaction reference for tracking
  amount: number;
  currency: 'ETB';
}

export interface WithdrawResponse {
  withdrawalId: string;
  status: TransactionStatus;
  estimatedProcessingTime: string;
}

// ── In-app Notification ────────────────────────────────────────
export interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  type: 'success' | 'info' | 'warning' | 'win';
  timestamp: string;
}

