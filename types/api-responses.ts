// API response types for Hired Always
// Source: /website/main.py and /website/api.py

export type IsoDateString = string;

export interface ErrorResponse {
  detail: string;
}

// main.py
export interface HealthResponse {
  status: "healthy";
}

export interface Category {
  id: number;
  name: string;
  jobCount: number;
  icon: string;
}

export interface CategoriesResponse {
  categories: Category[];
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

// api.py
export interface ValidateLicenseResponse {
  valid: true;
  user_id: string;
  start_date: IsoDateString;
  expires_at: IsoDateString;
}

export interface CheckUsageResponse {
  status: "free";
  valid: true;
  is_paid: false;
  is_unlimited: true;
  message: string;
}

export interface TrackUsageResponse {
  allowed: true;
  is_paid: false;
  is_unlimited: true;
  usage_count: number;
  message: string;
}

export interface ActivateWhitelistResponse {
  success: true;
  email: string;
  status: "whitelisted";
  message: string;
  is_whitelisted: true;
}

export interface AdminCreateLicenseResponse {
  license_key: string;
  user_id: string;
  expires_at: IsoDateString;
}

export interface AdminRevokeLicenseResponse {
  message: "License revoked successfully";
}

export interface CreateSubscriptionResponse {
  license_key: string;
  email: string;
  subscription_id: string;
  expires_at: IsoDateString;
}

export interface PayPalWebhookActivatedResponse {
  message: "Subscription activated";
  license_key: string;
}

export interface PayPalWebhookProcessedResponse {
  message: "Event processed";
}

export type PayPalWebhookResponse =
  | PayPalWebhookActivatedResponse
  | PayPalWebhookProcessedResponse;

// Proxy AI response comes from Gemini API; keep it flexible.
export type ProxyAiResponse = Record<string, unknown>;

// Convenience unions
export type ApiSuccessResponse =
  | HealthResponse
  | CategoriesResponse
  | ValidateLicenseResponse
  | CheckUsageResponse
  | TrackUsageResponse
  | ActivateWhitelistResponse
  | AdminCreateLicenseResponse
  | AdminRevokeLicenseResponse
  | CreateSubscriptionResponse
  | PayPalWebhookResponse
  | ProxyAiResponse;

export type ApiResponse = ApiSuccessResponse | ErrorResponse;
