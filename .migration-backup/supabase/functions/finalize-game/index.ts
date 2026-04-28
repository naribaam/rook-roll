// Finalize a game: validate, compute ELO, award coins.
// Called by both AI and multiplayer flows after game ends.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Body = {
  game_id: string;
  result: "white_win" | "black_win" | "draw";
  reason: string;
  move_quality?: {
    best: number;
    great: number;
    good: number;
    blunder: number;
  };
};

function kFactor(elo: number) {
  if (elo < 1400) return 32;
  if (elo < 2000) return 24;
  return 16;
}
function expected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}
function calcNewElo(player: number, opp: number, score: number) {
  return Math.round(player + kFactor(player) * (score - expected(player, opp)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.game_id || !body?.result) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: game, error: gErr } = await admin
      .from("games")
      .select("*")
      .eq("id", body.game_id)
      .maybeSingle();

    if (gErr || !game) {
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (game.status === "finished") {
      // Already finalized — return existing summary for the caller
      const isWhiteCaller = game.white_player === user.id;
      const callerElo = isWhiteCaller ? game.white_elo_after : game.black_elo_after;
      const callerEloBefore = isWhiteCaller ? game.white_elo_before : game.black_elo_before;
      return new Response(
        JSON.stringify({
          already_finished: true,
          result: game.result,
          reason: game.result_reason,
          elo_delta: (callerElo ?? 0) - (callerEloBefore ?? 0),
          new_elo: callerElo ?? 1200,
          coins_earned: 0,
          new_coins: 0,
          move_bonus: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Caller must be a participant (for AI games, black_player may be null)
    const isWhite = game.white_player === user.id;
    const isBlack = game.black_player === user.id;
    if (!isWhite && !isBlack) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch involved profiles
    const ids = [game.white_player, game.black_player].filter((x: string | null) => !!x) as string[];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, elo")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    // For AI games, use the stored ai elo as opponent elo
    const whiteElo = game.white_player ? (byId.get(game.white_player)?.elo ?? 1200) : 1200;
    const blackElo = game.black_player
      ? (byId.get(game.black_player)?.elo ?? 1200)
      : (game.black_elo_before ?? 1200); // AI elo stored at game creation

    let whiteScore = 0.5;
    if (body.result === "white_win") whiteScore = 1;
    else if (body.result === "black_win") whiteScore = 0;
    const blackScore = 1 - whiteScore;

    const whiteEloAfter = calcNewElo(whiteElo, blackElo, whiteScore);
    // Only update black ELO if there's a real black player (not AI)
    const blackEloAfter = game.black_player ? calcNewElo(blackElo, whiteElo, blackScore) : blackElo;
    const whiteDelta = whiteEloAfter - whiteElo;
    const blackDelta = blackEloAfter - blackElo;

    // Update white ELO
    if (game.white_player) {
      await admin.from("profiles").update({ elo: whiteEloAfter }).eq("id", game.white_player);
    }
    // Update black ELO only if real player
    if (game.black_player) {
      await admin.from("profiles").update({ elo: blackEloAfter }).eq("id", game.black_player);
    }

    // Increment game counters
    async function bumpCounters(uid: string | null, outcome: "win" | "loss" | "draw") {
      if (!uid) return;
      const field = outcome === "win" ? "games_won" : outcome === "loss" ? "games_lost" : "games_drawn";
      const { data: p } = await admin
        .from("profiles")
        .select("games_played, games_won, games_lost, games_drawn")
        .eq("id", uid)
        .single();
      if (!p) return;
      await admin
        .from("profiles")
        .update({ games_played: p.games_played + 1, [field]: (p as Record<string, number>)[field] + 1 })
        .eq("id", uid);
    }

    const whiteOutcome = body.result === "white_win" ? "win" : body.result === "black_win" ? "loss" : "draw";
    const blackOutcome = body.result === "black_win" ? "win" : body.result === "white_win" ? "loss" : "draw";
    await bumpCounters(game.white_player, whiteOutcome);
    await bumpCounters(game.black_player, blackOutcome);

    // Coin awards: win +100, draw +50, loss 0, plus move quality bonus
    const baseCoinsFor = (o: "win" | "loss" | "draw") => (o === "win" ? 100 : o === "draw" ? 50 : 0);
    const moveBonus = body.move_quality
      ? body.move_quality.best * 10 + body.move_quality.great * 5 + body.move_quality.good * 2
      : 0;

    const callerId = user.id;
    async function awardFor(uid: string | null, outcome: "win" | "loss" | "draw", bonus: number) {
      if (!uid) return 0;
      const base = baseCoinsFor(outcome);
      const total = base + (uid === callerId ? bonus : 0);
      if (total > 0) {
        const txType = outcome === "win" ? "win" : outcome === "draw" ? "draw" : "loss";
        await admin.rpc("award_coins", {
          _user_id: uid,
          _amount: total,
          _type: txType,
          _description: `${outcome.toUpperCase()} reward${uid === callerId && bonus > 0 ? ` + ${bonus} move bonus` : ""}`,
          _game_id: game.id,
        });
      }
      return total;
    }

    const whiteAward = await awardFor(game.white_player, whiteOutcome, moveBonus);
    const blackAward = await awardFor(game.black_player, blackOutcome, moveBonus);

    await admin
      .from("games")
      .update({
        status: "finished",
        result: body.result,
        result_reason: body.reason ?? "",
        white_elo_before: whiteElo,
        black_elo_before: blackElo,
        white_elo_after: whiteEloAfter,
        black_elo_after: blackEloAfter,
        finished_at: new Date().toISOString(),
        draw_offered_by: null,
      })
      .eq("id", game.id);

    const callerOutcome = isWhite ? whiteOutcome : blackOutcome;
    const callerDelta = isWhite ? whiteDelta : blackDelta;
    const callerAward = isWhite ? whiteAward : blackAward;
    const callerEloAfter = isWhite ? whiteEloAfter : blackEloAfter;

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .single();

    return new Response(
      JSON.stringify({
        ok: true,
        outcome: callerOutcome,
        reason: body.reason,
        elo_delta: callerDelta,
        new_elo: callerEloAfter,
        coins_earned: callerAward,
        new_coins: callerProfile?.coins ?? 0,
        move_bonus: moveBonus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("finalize-game error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
