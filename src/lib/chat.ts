"use client";

import * as signalR from "@microsoft/signalr";

import { API_BASE_URL } from "@/lib/api";

export type ChatMessageDto = {
  id: number;
  senderId: string;
  receiverId: string;
  message: string;
  sentAt: string;
  readAt: string | null;
  isMine: boolean;
};

export function createChatConnection(getToken: () => string) {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/chathub`, {
      accessTokenFactory: getToken,
    })
    .withAutomaticReconnect()
    .build();
}

export function bindChatEvents(
  connection: signalR.HubConnection,
  handlers: {
    onReceive?: (message: ChatMessageDto) => void;
    onSent?: (message: ChatMessageDto) => void;
    onRead?: (readerUserId: string, readAtUtc: string) => void;
    onTyping?: (fromUserId: string) => void;
  },
) {
  if (handlers.onReceive) {
    connection.on("ReceiveMessageV2", handlers.onReceive);
  }

  if (handlers.onSent) {
    connection.on("MessageSentV2", handlers.onSent);
  }

  if (handlers.onRead) {
    connection.on("MessagesRead", handlers.onRead);
  }

  if (handlers.onTyping) {
    connection.on("Typing", handlers.onTyping);
  }

  return () => {
    connection.off("ReceiveMessageV2");
    connection.off("MessageSentV2");
    connection.off("MessagesRead");
    connection.off("Typing");
  };
}
