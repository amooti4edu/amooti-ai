import { Plus, X } from "lucide-react";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  conversations: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function ChatSidebar({ open, onClose, conversations, activeId, onSelect, onNewChat }: ChatSidebarProps) {
  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 flex-shrink-0 bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col border-r border-sidebar-border`}
      >
        <div className="flex items-center justify-between p-4">
          <h2 className="font-serif text-lg">Chats</h2>
          <div className="flex gap-2">
            <button onClick={onNewChat} className="rounded-md p-1.5 hover:bg-sidebar-accent" title="New chat">
              <Plus size={18} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-sidebar-accent lg:hidden">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm truncate transition ${
                activeId === c.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
              }`}
            >
              {c.title || "New Chat"}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-sidebar-foreground/40">
              No conversations yet
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
