-- Support ticket lifecycle: allow an intermediate "waiting" state after admin replies.
-- Existing values remain unchanged.

alter type public.ticket_status add value if not exists 'waiting';
