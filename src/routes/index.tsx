import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Todo — Stay focused" },
      { name: "description", content: "A minimal, beautiful todo app to organize your day." },
    ],
  }),
});

type Todo = { id: string; text: string; done: boolean };

const STORAGE_KEY = "todos.v1";

function Index() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTodos(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos, hydrated]);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setTodos((prev) => [{ id: crypto.randomUUID(), text: t, done: false }, ...prev]);
    setText("");
  };

  const toggle = (id: string) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const remove = (id: string) => setTodos((prev) => prev.filter((t) => t.id !== id));

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <main
      className="min-h-screen px-4 py-16 flex justify-center"
      style={{ background: "var(--gradient-bg)" }}
    >
      <div className="w-full max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Today</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {todos.length === 0
              ? "Add your first task to get started"
              : `${remaining} of ${todos.length} remaining`}
          </p>
        </header>

        <div
          className="bg-card rounded-2xl p-3 flex gap-2 mb-6"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What needs doing?"
            className="border-0 shadow-none focus-visible:ring-0 text-base"
          />
          <Button
            onClick={add}
            size="icon"
            className="shrink-0"
            style={{ background: "var(--gradient-primary)" }}
            aria-label="Add todo"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ul className="space-y-2">
          {todos.map((t) => (
            <li
              key={t.id}
              className="group bg-card rounded-xl p-4 flex items-center gap-3 transition hover:translate-x-0.5"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <button
                onClick={() => toggle(t.id)}
                aria-label={t.done ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "h-6 w-6 rounded-full border-2 flex items-center justify-center transition shrink-0",
                  t.done ? "border-transparent text-primary-foreground" : "border-border hover:border-primary",
                )}
                style={t.done ? { background: "var(--gradient-primary)" } : undefined}
              >
                {t.done && <Check className="h-3.5 w-3.5" />}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm transition",
                  t.done ? "line-through text-muted-foreground" : "text-foreground",
                )}
              >
                {t.text}
              </span>
              <button
                onClick={() => remove(t.id)}
                aria-label="Delete todo"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
