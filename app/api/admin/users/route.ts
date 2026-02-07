import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const banned = searchParams.get("banned");
  const accountType = searchParams.get("account_type");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (banned === "true") {
      query = query.eq("banned", true);
    }
    if (accountType) {
      query = query.eq("account_type", accountType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Admin users error:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    return NextResponse.json({ users: data });
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { id, action, reason } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "ban":
        updateData = {
          banned: true,
          ban_reason: reason || "Banned by admin",
          banned_at: new Date().toISOString(),
        };
        break;
      case "unban":
        updateData = {
          banned: false,
          ban_reason: null,
          banned_at: null,
        };
        break;
      case "revoke_api_key":
        updateData = { api_key: null };
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { error } = await supabase.from("agents").update(updateData).eq("id", id);

    if (error) {
      console.error("Admin user update error:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const idsParam = searchParams.get("ids"); // For bulk delete

  // Support both single id and bulk ids
  const idsToDelete: string[] = [];
  if (id) {
    idsToDelete.push(id);
  }
  if (idsParam) {
    idsToDelete.push(...idsParam.split(",").filter(Boolean));
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json({ error: "Missing user id(s)" }, { status: 400 });
  }

  // Check for admin user and filter them out
  const { data: usersToCheck } = await supabase
    .from("agents")
    .select("id, email")
    .in("id", idsToDelete);

  const adminUserIds = usersToCheck?.filter(u => u.email?.toLowerCase() === ADMIN_EMAIL).map(u => u.id) || [];
  const filteredIds = idsToDelete.filter(id => !adminUserIds.includes(id));
  const adminSkipped = adminUserIds.length > 0;

  // If only admin was selected, return error
  if (filteredIds.length === 0) {
    return NextResponse.json({ error: "Cannot delete admin user" }, { status: 403 });
  }

  // Use filtered IDs for deletion
  const idsForDeletion = filteredIds;

  try {
    // 1. Delete user's votes
    const { error: votesError } = await supabase
      .from("votes")
      .delete()
      .in("voter_id", idsForDeletion);

    if (votesError) {
      console.error("Admin votes delete error:", votesError);
    }

    // 2. Delete user's comments (or reassign to "Deleted User")
    const { error: commentsError } = await supabase
      .from("comments")
      .delete()
      .in("author_id", idsForDeletion);

    if (commentsError) {
      console.error("Admin comments delete error:", commentsError);
    }

    // 3. Get dilemmas submitted by these users
    const { data: userDilemmas } = await supabase
      .from("agent_dilemmas")
      .select("id")
      .in("submitter_id", idsForDeletion);

    if (userDilemmas && userDilemmas.length > 0) {
      const dilemmaIds = userDilemmas.map(d => d.id);

      // Delete votes on those dilemmas
      await supabase
        .from("votes")
        .delete()
        .in("dilemma_id", dilemmaIds);

      // Delete comments on those dilemmas
      await supabase
        .from("comments")
        .delete()
        .in("dilemma_id", dilemmaIds);

      // Delete the dilemmas
      await supabase
        .from("agent_dilemmas")
        .delete()
        .in("submitter_id", idsForDeletion);
    }

    // 4. Delete the users
    const { error } = await supabase
      .from("agents")
      .delete()
      .in("id", idsForDeletion);

    if (error) {
      console.error("Admin user delete error:", error);
      return NextResponse.json({ error: "Failed to delete user(s)" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: idsForDeletion.length,
      adminSkipped: adminSkipped
    });
  } catch (err) {
    console.error("Admin user delete error:", err);
    return NextResponse.json({ error: "Failed to delete user(s)" }, { status: 500 });
  }
}
