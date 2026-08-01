import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { username, password, name, title, role } = body;

    if (!username || !password || !name) {
      return new Response(JSON.stringify({ error: "Username, password, and name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const syntheticEmail = `${normalizedUsername}@app.local`;

    // Check username uniqueness against profiles
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Username already taken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRole = role === "admin" ? "admin" : "staff";

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        name: String(name).trim(),
        title: title ? String(title).trim() : null,
        username: normalizedUsername,
        role: userRole,
      },
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? "Failed to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // handle_new_user trigger creates the profile with the role from metadata.
    // Ensure the role is set correctly (trigger reads raw_user_meta_data->>'role').
    await admin
      .from("profiles")
      .update({ role: userRole })
      .eq("id", newUser.user.id);

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
