export type ContactMessage = {
  email: string;
  subject: string;
  message: string;
};

export type ContactErrors = Partial<Record<keyof ContactMessage, string>>;

export type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  content: string;
};
