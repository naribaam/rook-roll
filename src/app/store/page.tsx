"use client";

import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PIECE_SKINS, BOARD_SKINS, type ShopItem, boardColors } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Coins, Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function StorePage() {
  return (
    <Layout>
      <AuthGate>
        <Inner />
      </AuthGate>
    </Layout>
  );
}

function Inner() {
  const { user, profile, refreshProfile } = useAuth();
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("purchases")
      .select("item_type, item_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const s = new Set<string>();
        for (const r of data ?? []) s.add(`${r.item_type}:${r.item_id}`);
        setOwned(s);
      });
  }, [user]);

  const purchase = async (item: ShopItem) => {
    setBusy(item.id);
    try {
      const { error } = await supabase.rpc("purchase_item", {
        _item_type: item.type,
        _item_id: item.id,
        _price: item.price,
      });
      if (error) throw error;
      setOwned((s) => new Set(s).add(`${item.type}:${item.id}`));
      await refreshProfile();
      toast.success(`Unlocked ${item.name}!`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const equip = async (item: ShopItem) => {
    setBusy(item.id);
    try {
      const { error } = await supabase.rpc("equip_skin", {
        _item_type: item.type,
        _item_id: item.id,
      });
      if (error) throw error;
      await refreshProfile();
      toast.success(`Equipped ${item.name}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not equip");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="rounded-3xl bg-[image:var(--gradient-gold)] px-6 py-8 text-accent-foreground shadow-[var(--shadow-elegant)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-black/15 px-3 py-1 text-xs font-bold">
              <Sparkles className="h-3 w-3" /> Cosmetic store
            </span>
            <h1 className="text-3xl font-bold">Customize your game</h1>
            <p className="text-sm opacity-80">No pay-to-win. Only style.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-black/15 px-4 py-3">
            <Coins className="h-6 w-6" />
            <div>
              <p className="text-xs opacity-70">Balance</p>
              <p className="font-mono text-2xl font-bold">{profile?.coins ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <Section title="Board skins" items={BOARD_SKINS} renderPreview={(i) => <BoardPreview id={i.id} />}>
        {(item) => renderItem(item, profile?.active_board_skin ?? "classic")}
      </Section>

      <Section title="Piece skins" items={PIECE_SKINS} renderPreview={(i) => (
        <div className="grid h-24 w-full place-items-center rounded-xl bg-secondary text-5xl">
          {i.preview}
        </div>
      )}>
        {(item) => renderItem(item, profile?.active_piece_skin ?? "classic")}
      </Section>
    </div>
  );

  function renderItem(item: ShopItem, activeId: string) {
    const ownedKey = `${item.type}:${item.id}`;
    const isOwned = item.id === "classic" || owned.has(ownedKey);
    const isActive = activeId === item.id;
    if (isActive) {
      return (
        <Button variant="outline" size="sm" disabled className="w-full">
          <Check className="h-4 w-4" /> Equipped
        </Button>
      );
    }
    if (isOwned) {
      return (
        <Button
          variant="hero"
          size="sm"
          className="w-full"
          onClick={() => equip(item)}
          disabled={busy === item.id}
        >
          Equip
        </Button>
      );
    }
    const canAfford = (profile?.coins ?? 0) >= item.price;
    return (
      <Button
        variant={canAfford ? "gold" : "outline"}
        size="sm"
        className="w-full"
        disabled={!canAfford || busy === item.id}
        onClick={() => purchase(item)}
      >
        {canAfford ? <Coins className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        {item.price}
      </Button>
    );
  }
}

function Section({
  title,
  items,
  renderPreview,
  children,
}: {
  title: string;
  items: ShopItem[];
  renderPreview: (item: ShopItem) => React.ReactNode;
  children: (item: ShopItem) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
          >
            {renderPreview(item)}
            <h3 className="mt-3 font-bold">{item.name}</h3>
            <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
            {children(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

function BoardPreview({ id }: { id: string }) {
  const c = boardColors(id);
  return (
    <div className="grid h-24 grid-cols-4 grid-rows-4 overflow-hidden rounded-xl">
      {Array.from({ length: 16 }).map((_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const isLight = (row + col) % 2 === 0;
        return (
          <div
            key={i}
            style={{ backgroundColor: isLight ? c.light : c.dark }}
          />
        );
      })}
    </div>
  );
}
