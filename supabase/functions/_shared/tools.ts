// ============================================================================
//  tools.ts
//  Tool definitions and executor.
//  Tools are a fallback only — context is always built first.
//  Whether tools are offered depends on the current model's supportsTools flag.
// ============================================================================

// ── Tool definitions (sent to LLM) ───────────────────────────────────────────

export const CURRICULUM_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_topic_context",
      description:
        "Get complete curriculum details for a topic: concepts, outcomes, activities, " +
        "applications, and quiz stems. Use when the student asks about a specific topic " +
        "not already covered in the context provided.",
      parameters: {
        type: "object",
        properties: {
          topic:   { type: "string", description: "Topic name to look up" },
          subject: { type: "string", description: "Subject e.g. 'Chemistry', 'Biology'" },
          class:   { type: "string", description: "Class e.g. 'Senior 1', 'Senior 2'" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_concepts",
      description:
        "Search for specific concepts by name or description. Use when the student asks " +
        "about a term or idea that wasn't in the initial context.",
      parameters: {
        type: "object",
        properties: {
          query:   { type: "string",  description: "Concept to search for" },
          subject: { type: "string",  description: "Optional subject filter" },
          class:   { type: "string",  description: "Optional class filter" },
          limit:   { type: "number",  description: "Number of results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_prerequisites",
      description:
        "Find what concepts a student needs to know before learning a given concept. " +
        "Use when the student seems confused and may be missing foundational knowledge.",
      parameters: {
        type: "object",
        properties: {
          concept_name: { type: "string", description: "The concept to find prerequisites for" },
          subject:      { type: "string", description: "Subject filter" },
        },
        required: ["concept_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cross_subject_links",
      description:
        "Find how a concept connects to other subjects. Use when explaining how topics " +
        "relate across the curriculum.",
      parameters: {
        type: "object",
        properties: {
          concept_name: { type: "string", description: "Concept to find cross-subject links for" },
          subject:      { type: "string", description: "The concept's home subject" },
        },
        required: ["concept_name"],
      },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  sb:   any,
): Promise<string> {
  console.log(`[Tool] Executing "${name}":`, JSON.stringify(args));

  try {
    switch (name) {

      case "get_topic_context": {
        // First find the topic node by searching
        const { data: topics } = await sb.rpc("match_topic_nodes", {
          // We can't embed here without another API call so we do a text search
          // via the topic name using a direct table query
        });
        // Fall back to text search on topic name
        const { data, error } = await sb
          .from("topic_nodes")
          .select("topic_id, topic, subject, class, term")
          .ilike("topic", `%${args.topic}%`)
          .eq(args.subject ? "subject" : "topic_id", args.subject ?? sb)
          .limit(1)
          .single();

        if (error || !data) return `No topic found matching "${args.topic}"`;

        const { data: ctx } = await sb.rpc("get_topic_context", {
          p_topic_id: data.topic_id,
        });
        return JSON.stringify(ctx ?? {}, null, 2);
      }

      case "search_concepts": {
        // Text search on concept names and definitions
        let query = sb
          .from("curriculum_nodes")
          .select("name, definition, concept_type, subject, class, topic, vocabulary, skills")
          .or(`name.ilike.%${args.query}%,definition.ilike.%${args.query}%`);

        if (args.subject) query = query.eq("subject", args.subject);
        if (args.class)   query = query.eq("class",   args.class);

        query = query.limit(args.limit ?? 5);

        const { data, error } = await query;
        if (error) return `Search error: ${error.message}`;
        if (!data?.length) return `No concepts found for "${args.query}"`;
        return JSON.stringify(data, null, 2);
      }

      case "get_prerequisites": {
        // Find the concept node first by text match
        const { data: concept } = await sb
          .from("curriculum_nodes")
          .select("node_id")
          .ilike("name", `%${args.concept_name}%`)
          .eq(args.subject ? "subject" : "node_id", args.subject ?? sb)
          .limit(1)
          .single();

        if (!concept) return `Concept "${args.concept_name}" not found`;

        const { data } = await sb.rpc("get_prerequisites", {
          p_node_id: concept.node_id,
          max_depth: 2,
        });
        if (!data?.length) return `No prerequisites found for "${args.concept_name}"`;
        return JSON.stringify(data, null, 2);
      }

      case "get_cross_subject_links": {
        const { data: concept } = await sb
          .from("curriculum_nodes")
          .select("node_id")
          .ilike("name", `%${args.concept_name}%`)
          .limit(1)
          .single();

        if (!concept) return `Concept "${args.concept_name}" not found`;

        const { data } = await sb.rpc("get_interdisciplinary_links", {
          p_node_id: concept.node_id,
        });
        if (!data?.length) return `No cross-subject links found for "${args.concept_name}"`;
        return JSON.stringify(data, null, 2);
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    console.error(`[Tool] "${name}" threw:`, err);
    return `Tool error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}
