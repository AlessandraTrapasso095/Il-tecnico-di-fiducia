import type { Metadata } from "next";

import GuestTicketClient from "./guest-ticket-client";

export const metadata: Metadata = {
  title: "Ticket assistenza | Il Tecnico di Fiducia",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default async function GuestSupportTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const token = Array.isArray(query.token)
    ? (query.token[0] ?? "")
    : (query.token ?? "");

  return <GuestTicketClient ticketId={id} token={token} />;
}
