export type MentionDTO = {
  id: string;
  text: string;
  senderName: string | null;
  senderJid: string;
  timestamp: string;
  processed: boolean;
  group: { id: string; name: string } | null;
};

export type MentionDetailDTO = MentionDTO & {
  tasks: { id: string; title: string; status: string }[];
  surrounding: { id: string; senderName: string | null; text: string; timestamp: string }[];
};

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  requester: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  group: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  imageUrls: string[];
};

export type TaskDetailDTO = TaskDTO & {
  mention: { id: string; text: string; senderName: string | null; timestamp: string } | null;
};

export type GroupDTO = {
  id: string;
  name: string;
  mentionCount: number;
  taskCount: number;
};

export type ProjectDTO = {
  id: string;
  name: string;
  role: string;
  techStack: string | null;
  totalTasks: number;
  openTasks: number;
  groups: { id: string; name: string }[];
};

export type SummaryDTO = {
  id: string;
  content: string;
  mentionFrom: string;
  mentionTo: string;
  createdAt: string;
  group: { id: string; name: string };
};

export type MemberDTO = {
  id: string;
  name: string;
  image: string | null;
  role: string;
};

export type ListenerStatus = {
  listener: { connected: boolean; myJid: string | null; lastSeen: string | null };
  mentions: { pending: number; today: number };
  serverTime: string;
};
