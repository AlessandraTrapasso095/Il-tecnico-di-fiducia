export type UserRole = "customer" | "professional" | "admin";
export type RequestStatus = "pending" | "accepted" | "rejected" | "concluded";

export type MeResponse = {
  user: { id: string; email?: string | null };
  profile: {
    id: string;
    role: UserRole;
    first_name: string;
    last_name: string;
  };
};

export type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  province_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  is_online?: boolean;
};

export type ConversationRow = {
  id: string;
  request_id: string;
  status: RequestStatus;
  customer_id: string;
  professional_id: string;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  created_at: string;
  updated_at: string;
  request_subject?: string | null;
  participant?: Participant | null;
};

export type ConversationsResponse = {
  conversations: (ConversationRow & { participant?: Participant | null })[];
};

export type ContactRequestSummary = {
  id: string;
  subject: string;
  status: RequestStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationDetailResponse = {
  conversation: ConversationRow;
  request: ContactRequestSummary | null;
  participant: Participant | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  attachments?: MessageAttachment[];
};

export type MessageAttachment = {
  id: string;
  message_id: string;
  conversation_id: string;
  bucket_id: string;
  file_path: string;
  file_type: "image" | "video" | "document";
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  signed_url: string;
  expires_at: string;
  created_at: string;
};

export type MessagesResponse = { messages: MessageRow[] };

export type QuoteStatus = "pending" | "accepted" | "rejected";

export type QuoteRow = {
  id: string;
  conversation_id: string;
  professional_id: string;
  client_id: string;
  description: string;
  amount: number;
  discount_percentage: number;
  final_amount: number;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
};

export type ConversationQuoteContext = {
  conversation: {
    id: string;
    request_id: string;
    status: RequestStatus;
    customer_id: string;
    professional_id: string;
  };
  professional: (Participant & { email: string | null; phone: string | null }) | null;
  client: (Participant & { email: string | null; phone: string | null }) | null;
};

export type ConversationQuotesResponse = {
  quotes: QuoteRow[];
  context: ConversationQuoteContext | null;
};
