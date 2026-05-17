export type UserRole = "customer" | "professional" | "admin";
export type RequestStatus = "pending" | "accepted" | "rejected";

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
  avatar_url?: string | null;
  headline?: string | null;
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
  body: string;
  created_at: string;
};

export type MessagesResponse = { messages: MessageRow[] };

